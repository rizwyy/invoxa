import { localRepo } from '../backend/local-runtime'
import { reminderInvoices, today } from '../shared/domain'
for (const row of await localRepo.workspaces()) {
  const w = row.data
  if (!w.reminders) continue
  const list = (await localRepo.list(`WS#${w.id}`, 'INV#')).map(r => r.data)
  const invoices = reminderInvoices(list, w)
  console.log(JSON.stringify({ date: today(), workspace: w.name, invoiceCount: invoices.length, delivery: 'preview only; no email sent' }))
}
