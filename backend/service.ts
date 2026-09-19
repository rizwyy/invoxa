import { randomUUID, createHash } from 'node:crypto'
import { z } from 'zod'
import { emptyFields, fieldsSchema, workspaceSchema, uploadSchema, MAX_INVOICES, summary, reminderInvoices, type Identity, type Invoice, type Workspace } from '../shared/domain'
import { AppError, Conflict, type Repository } from './repository'
import { validateFile, type Files } from './files'
import { findPossibleDuplicate } from './extraction'
export interface Extractor { start(invoice: Invoice): Promise<string> }
export class InvoiceService {
  constructor(public repo: Repository, public files: Files, public extractor?: Extractor) {}
  async workspace(user: Identity): Promise<Workspace | undefined> { return (await this.repo.get(`USER#${user.id}`, 'WORKSPACE'))?.data }
  async requireWorkspace(user: Identity) { const w = await this.workspace(user); if (!w) throw new AppError(403, 'Create your business workspace first'); if (w.ownerId !== user.id) throw new AppError(403, 'Workspace access denied'); return w }
  async createWorkspace(user: Identity, body: unknown) {
    const { name } = z.object({ name: z.string().trim().min(2).max(100) }).parse(body)
    if (await this.workspace(user)) throw new AppError(409, 'You already have a workspace')
    // One owner / workspace: derive the partition from verified identity, never from the request body.
    const id = createHash('sha256').update(user.id).digest('hex').slice(0, 32)
    const w: Workspace = { id, ownerId: user.id, email: user.email, name, reminders: false, reminderDays: 7, version: 1 }
    await this.repo.put({ pk: `USER#${user.id}`, sk: 'WORKSPACE', version: 1, data: w }, 0)
    return w
  }
  async updateWorkspace(user: Identity, body: any) {
    const w = await this.requireWorkspace(user); const fields = workspaceSchema.parse(body)
    if (body.version !== w.version) throw new Conflict()
    const next = { ...w, ...fields, version: w.version + 1 }
    await this.repo.put({ pk: `USER#${user.id}`, sk: 'WORKSPACE', version: next.version, data: next }, w.version)
    return next
  }
  async list(user: Identity) { const w = await this.requireWorkspace(user); return this.listWorkspace(w.id) }
  async listWorkspace(id: string): Promise<Invoice[]> { return (await this.repo.list(`WS#${id}`, 'INV#')).map(r => r.data).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
  async get(user: Identity, id: string) { const w = await this.requireWorkspace(user); const i = (await this.repo.get(`WS#${w.id}`, `INV#${id}`))?.data as Invoice | undefined; if (!i) throw new AppError(404, 'Invoice not found'); return i }
  async save(i: Invoice, expected: number) { i.updatedAt = new Date().toISOString(); i.version = expected + 1; await this.repo.put({ pk: `WS#${i.workspaceId}`, sk: `INV#${i.id}`, version: i.version, data: i }, expected); return i }
  async consumeQuota(workspaceId: string, name: string, limit: number) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const pk = `WS#${workspaceId}`; const sk = `QUOTA#${name}`
      const row = await this.repo.get(pk, sk)
      const count = row?.data.count || 0
      if (count >= limit) throw new AppError(429, `Pilot upload limit reached (${limit} ${name === 'total' ? 'total' : 'per day'}).`)
      try { await this.repo.put({ pk, sk, version: (row?.version || 0) + 1, data: { count: count + 1 } }, row?.version || 0); return } catch (e) { if (!(e instanceof Conflict)) throw e }
    }
    throw new AppError(429, 'Too many simultaneous uploads. Try again shortly.')
  }
  async reserve(user: Identity, body: unknown) {
    const w = await this.requireWorkspace(user); const file = uploadSchema.parse(body)
    await this.consumeQuota(w.id, new Date().toISOString().slice(0, 10), 50)
    await this.consumeQuota(w.id, 'total', MAX_INVOICES)
    const id = randomUUID(); const now = new Date().toISOString()
    const invoice: Invoice = { ...emptyFields(), id, workspaceId: w.id, version: 1, reviewed: false, archived: false, processing: 'awaiting-upload', createdAt: now, updatedAt: now, paidAt: null, file: { ...file, key: `incoming/${w.id}/${id}` } }
    await this.repo.put({ pk: `WS#${w.id}`, sk: `INV#${id}`, version: 1, data: invoice }, 0)
    return { invoice, upload: await this.files.request(invoice.file!.key, file.type, file.size) }
  }
  async complete(user: Identity, id: string) {
    let i = await this.get(user, id)
    if (i.processing !== 'awaiting-upload') return i
    const bytes = await this.files.read(i.file!.key)
    if (bytes.length !== i.file!.size) throw new AppError(400, 'Uploaded file size differs from the reserved size')
    let hash: string
    try { hash = await validateFile(bytes, i.file!.type) } catch (e) { i.processing = 'rejected'; i.failure = e instanceof Error ? e.message : 'Invalid document'; await this.save(i, i.version); await this.files.remove(i.file!.key).catch(() => {}); throw e }
    const candidates = await this.list(user)
    // Freeze validated bytes under a key that cannot be overwritten by a browser upload grant.
    if (!this.files.write) throw new Error('Document writer is unavailable')
    const frozenKey = `documents/${i.workspaceId}/${i.id}`
    await this.files.write(frozenKey, bytes)
    i.file = { ...i.file!, key: frozenKey, hash }
    i.duplicate = findPossibleDuplicate(i, candidates)
    i.processing = this.extractor ? 'processing' : 'needs-review'
    i.extraction = { source: this.extractor ? 'textract' : 'manual', confidence: {}, reviewFields: !this.extractor ? ['vendor', 'number', 'date', 'total'] : [], warnings: [ ...(i.duplicate ? ['Possible duplicate detected. Open the matching invoice before confirming this one.'] : []), ...(!this.extractor ? ['Local mode: extraction is not running. Enter the details from your document.'] : []) ] }
    i = await this.save(i, i.version)
    if (this.extractor) {
      await this.repo.put({ pk: `JOB#${i.id}`, sk: 'JOB', version: 1, data: { workspaceId: i.workspaceId, invoiceId: i.id } })
      try { const jobId = await this.extractor.start(i); const current = await this.get(user, id); if (current.processing === 'processing') { current.jobId = jobId; i = await this.save(current, current.version) } } catch (error) {
        console.error(JSON.stringify({ event: 'extraction_start_failure', invoiceId: i.id, errorType: error instanceof Error ? error.name : 'unknown', message: error instanceof Error ? error.message : 'unknown' }))
        const current = await this.get(user, id); if (current.processing === 'processing') { current.processing = 'failed'; current.failure = 'Automatic extraction could not start. The original document is safe; enter the details manually or ask an administrator to check the processing logs.'; i = await this.save(current, current.version) }
      }
    }
    await this.files.remove(`incoming/${i.workspaceId}/${i.id}`).catch(() => {})
    return i
  }
  async edit(user: Identity, id: string, body: any) {
    const i = await this.get(user, id)
    if (i.archived) throw new AppError(400, 'Restore this invoice before editing')
    if (i.processing === 'rejected') throw new AppError(400, 'Upload a valid document in a new record');
    if (i.processing === 'awaiting-upload') throw new AppError(400, 'Finish the document upload first')
    if (body.version !== i.version) throw new Conflict()
    if (body.acknowledged !== true) throw new AppError(400, 'Confirm you reviewed the invoice')
    const fields = fieldsSchema.parse(body)
    if (fields.subtotal + fields.tax !== fields.total && body.acceptDifference !== true) throw new AppError(400, 'Acknowledge the difference between subtotal, tax and total')
    const next = { ...i, ...fields, reviewed: true, processing: 'confirmed' as const, failure: undefined, paidAt: fields.payment === 'paid' ? i.paidAt || new Date().toISOString() : null }
    next.duplicate = findPossibleDuplicate(next, await this.list(user))
    if (next.extraction) next.extraction.warnings = [...next.extraction.warnings.filter(warning => !warning.startsWith('Possible duplicate')), ...(next.duplicate ? ['Possible duplicate detected. Compare the matching invoice before relying on this record.'] : [])]
    return this.save(next, i.version)
  }
  async action(user: Identity, id: string, body: any) {
    const input = z.object({ version: z.number().int(), action: z.enum(['paid', 'unpaid', 'archive', 'restore']) }).parse(body)
    const i = await this.get(user, id); if (input.version !== i.version) throw new Conflict()
    if (input.action === 'archive' || input.action === 'restore') i.archived = input.action === 'archive'
    else { if (!i.reviewed || i.archived) throw new AppError(400, 'Review and restore the invoice before changing payment status'); i.payment = input.action; i.paidAt = input.action === 'paid' ? new Date().toISOString() : null }
    return this.save(i, i.version)
  }
  async document(user: Identity, id: string) { const i = await this.get(user, id); if (!i.file || i.processing === 'awaiting-upload' || i.processing === 'rejected') throw new AppError(404, 'Document is not ready'); return { url: await this.files.view(i.file.key, i.file.type), type: i.file.type } }
  async handle(user: Identity, method: string, path: string, body: any) {
    if (['POST', 'PATCH'].includes(method) && (!body || typeof body !== 'object' || Array.isArray(body))) throw new AppError(400, 'A JSON object is required')
    if (method === 'GET' && path === '/me') return { user, workspace: await this.workspace(user) || null }
    if (path === '/workspace' && method === 'POST') return this.createWorkspace(user, body)
    if (path === '/workspace' && method === 'PATCH') return this.updateWorkspace(user, body)
    if (path === '/invoices' && method === 'GET') return this.list(user)
    if (path === '/uploads' && method === 'POST') return this.reserve(user, body)
    if (path === '/summary' && method === 'GET') return summary(await this.list(user))
    if (path === '/reminders/preview' && method === 'GET') { const w = await this.requireWorkspace(user); return { enabled: w.reminders, recipient: w.email, invoices: reminderInvoices(await this.list(user), w) } }
    const match = path.match(/^\/invoices\/([a-zA-Z0-9-]+)(?:\/(complete|document|action))?$/)
    if (match) {
      const id = match[1]!
      if (method === 'GET' && !match[2]) return this.get(user, id)
      if (method === 'PATCH' && !match[2]) return this.edit(user, id, body)
      if (method === 'POST' && match[2] === 'complete') return this.complete(user, id)
      if (method === 'POST' && match[2] === 'action') return this.action(user, id, body)
      if (method === 'GET' && match[2] === 'document') return this.document(user, id)
    }
    throw new AppError(404, 'Endpoint not found')
  }
}
