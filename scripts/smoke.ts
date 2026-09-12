import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'
async function call(path: string, method = 'GET', body?: any, cookie = '') { const response = await fetch(`${base}/api${path}`, { method, headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}) }, body: body instanceof Uint8Array ? new Uint8Array(body).buffer : body ? JSON.stringify(body) : undefined }); return response }
const creds = { email: `smoke-${Date.now()}@example.test`, password: 'unique-smoke-test-password' }
const signup = await call('/auth/signup', 'POST', creds); assert.equal(signup.status, 200); const cookie = signup.headers.get('set-cookie')!.split(';')[0]!
assert.equal((await call('/workspace', 'POST', { name: 'Smoke test workspace' }, cookie)).status, 200)
const doc = await PDFDocument.create(); doc.addPage().drawText('Smoke invoice INR 118'); const bytes = await doc.save()
const reserve = await call('/uploads', 'POST', { name: 'smoke.pdf', type: 'application/pdf', size: bytes.length }, cookie); assert.equal(reserve.status, 200); const result: any = await reserve.json()
assert.equal((await call(result.upload.url.replace('/api', ''), 'PUT', bytes, cookie)).status, 200)
const complete = await call(`/invoices/${result.invoice.id}/complete`, 'POST', {}, cookie); assert.equal(complete.status, 200); const i: any = await complete.json()
const save = await call(`/invoices/${i.id}`, 'PATCH', { version: i.version, vendor: 'Smoke supplier', number: 'SMOKE-1', date: '2026-09-12', due: '2026-09-15', subtotal: 10000, tax: 1800, total: 11800, currency: 'INR', payment: 'unpaid', notes: '', acknowledged: true }, cookie); assert.equal(save.status, 200)
const file = await call(`/local-file/${i.id}`, 'GET', undefined, cookie); assert.equal(file.status, 200); assert.equal(file.headers.get('content-type'), 'application/pdf')
assert.equal((await call(`/local-file/${i.id}`)).status, 401)
const noOrigin = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(noOrigin.status, 403)
assert.equal((await call('/auth/logout', 'POST', {}, cookie)).status, 200)
assert.equal((await call('/me', 'GET', undefined, cookie)).status, 401)
console.log('HTTP smoke passed: signup → workspace → upload → validation → review → private file → logout; unauthenticated and cross-origin requests denied.')
