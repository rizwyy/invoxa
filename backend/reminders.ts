import { reminderInvoices, money, today, type Workspace } from '../shared/domain'
import { Conflict, type Repository } from './repository'
export interface Mailer { send(to: string, subject: string, text: string): Promise<void> }
export async function runReminders(repo: Repository, mailer: Mailer, day = today()) {
  let sent = 0; let skipped = 0
  for (const row of await repo.workspaces()) {
    const w = row.data as Workspace
    if (!w.reminders) continue
    const invoices = (await repo.list(`WS#${w.id}`, 'INV#')).map(r => r.data)
    const due = reminderInvoices(invoices, w, day)
    if (!due.length) continue
    const pk = `WS#${w.id}`; const sk = `REMINDER#${day}`
    // Claim once before sending. Ambiguous sends remain 'claimed' for human review rather than risking duplicate mail.
    try { await repo.put({ pk, sk, version: 1, data: { state: 'claimed', claimedAt: new Date().toISOString() } }, 0) } catch (e) { if (!(e instanceof Conflict)) throw e; skipped++; continue }
    const lines = due.map(i => `${i.vendor} · ${i.number} · ${money(i.total)} · due ${i.due}`)
    await mailer.send(w.email, `Invoxa: ${due.length} invoice${due.length === 1 ? '' : 's'} to check`, `Payment reminder for ${w.name}\n\n${lines.join('\n')}\n\nThese are recorded amounts, not a bank balance. Update paid invoices in Invoxa.\nManage or disable reminders in Settings.`)
    await repo.put({ pk, sk, version: 2, data: { state: 'sent', sentAt: new Date().toISOString(), invoiceCount: due.length } }, 1)
    sent++
  }
  return { sent, skipped }
}
