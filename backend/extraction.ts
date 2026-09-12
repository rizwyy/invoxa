import type { ExpenseDocument } from '@aws-sdk/client-textract'
import { toPaise, type Fields } from '../shared/domain'
export function normalizeExpense(documents: ExpenseDocument[]) {
  const fields: Partial<Fields> = {}; const confidence: Record<string, number> = {}; const warnings: string[] = []
  const first = documents[0]
  if (!first) return { fields, confidence, warnings: ['No invoice fields were detected. Enter the details manually.'] }
  if (documents.length > 1) warnings.push('More than one invoice may be present. Only the first detected invoice was mapped. Upload each invoice separately.')
  const map: Record<string, keyof Fields> = { VENDOR_NAME: 'vendor', INVOICE_RECEIPT_ID: 'number', INVOICE_RECEIPT_DATE: 'date', DUE_DATE: 'due', SUBTOTAL: 'subtotal', TAX: 'tax', TOTAL: 'total' }
  for (const f of first.SummaryFields || []) {
    const field = map[f.Type?.Text || '']; const raw = f.ValueDetection?.Text?.trim()
    if (!field || !raw) continue
    const score = f.ValueDetection?.Confidence || 0
    if (confidence[field] !== undefined && confidence[field]! >= score) continue
    confidence[field] = score
    if (['subtotal', 'tax', 'total'].includes(field)) {
      const n = toPaise(raw.replace(/INR|Rs\.?|₹|,/gi, '').trim())
      if (Number.isFinite(n) && n >= 0 && n <= 100_000_000_000) (fields as any)[field] = n
      else warnings.push(`Check ${field}: “${raw}” could not be read as an INR amount.`)
      if (f.Currency?.Code && f.Currency.Code !== 'INR') warnings.push(`Detected currency ${f.Currency.Code}. This pilot supports INR only; do not confirm a foreign-currency invoice as INR.`)
    } else if (field === 'date' || field === 'due') {
      let value = ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) value = raw
      else { const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); if (m) { if (+m[1]! <= 12 && +m[2]! <= 12 && m[1] !== m[2]) warnings.push(`Confirm ${field}: interpreted “${raw}” as day/month/year.`); value = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` } }
      if (value && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value) fields[field] = value
      else warnings.push(`Enter ${field} manually; the printed date was “${raw}”.`)
    } else (fields as any)[field] = raw.slice(0, field === 'vendor' ? 200 : 100)
    if (score < 90) warnings.push(`Check ${field}: extraction confidence is ${Math.round(score)}%.`)
  }
  if (!fields.due) warnings.push('No reliable due date found. Leave it blank unless the document or supplier provides one.')
  return { fields, confidence, warnings }
}
