import type { ExpenseDocument } from '@aws-sdk/client-textract'
import { toPaise, type Fields, type Invoice, type LineItem } from '../shared/domain'
export const REVIEW_CONFIDENCE = 90
const moneyField = (raw: string) => toPaise(raw.replace(/INR|Rs\.?|₹|,/gi, '').trim())
const text = (value: string | undefined, max: number) => value?.trim().slice(0, max) || ''
const normalizedKey = (value: string) => value.toLocaleLowerCase('en-IN').replace(/[^a-z0-9]/g, '')

export function findPossibleDuplicate(invoice: Pick<Invoice, 'id' | 'vendor' | 'number' | 'total' | 'file'>, candidates: Invoice[]) {
  const vendorKey = normalizedKey(invoice.vendor); const numberKey = normalizedKey(invoice.number)
  const other = candidates.find(candidate => candidate.id !== invoice.id && (
    Boolean(invoice.file?.hash && candidate.file?.hash === invoice.file.hash) ||
    Boolean(vendorKey && numberKey && invoice.total > 0 && normalizedKey(candidate.vendor) === vendorKey && normalizedKey(candidate.number) === numberKey && candidate.total === invoice.total)
  ))
  if (!other) return undefined
  return { invoiceId: other.id, reason: invoice.file?.hash && other.file?.hash === invoice.file.hash ? 'same-file' as const : 'matching-details' as const }
}

export function normalizeExpense(documents: ExpenseDocument[]) {
  const fields: Partial<Fields> = {}; const confidence: Record<string, number> = {}; const warnings: string[] = []; const reviewFields = new Set<string>()
  const first = documents[0]
  if (!first) return { fields, confidence, warnings: ['No invoice fields were detected. Enter the details manually.'], reviewFields: ['vendor', 'number', 'date', 'total'] }
  const expenseIndexes = [...new Set(documents.map(document => document.ExpenseIndex).filter((index): index is number => index !== undefined))]
  if (expenseIndexes.length > 1) warnings.push('More than one invoice may be present. Only the first detected invoice was mapped. Upload each invoice separately.')
  const selected = first.ExpenseIndex === undefined ? [first] : documents.filter(document => document.ExpenseIndex === first.ExpenseIndex)
  const map: Record<string, keyof Fields> = { VENDOR_NAME: 'vendor', INVOICE_RECEIPT_ID: 'number', INVOICE_RECEIPT_DATE: 'date', DUE_DATE: 'due', SUBTOTAL: 'subtotal', TAX: 'tax', TOTAL: 'total', VENDOR_ADDRESS: 'vendorAddress', TAX_PAYER_ID: 'vendorTaxId', VENDOR_TAX_ID: 'vendorTaxId', VENDOR_GST_NUMBER: 'vendorTaxId', VENDOR_ABN_NUMBER: 'vendorTaxId' }
  for (const f of selected.flatMap(document => document.SummaryFields || [])) {
    const field = map[f.Type?.Text || '']; const raw = f.ValueDetection?.Text?.trim()
    if (!field || !raw) continue
    const score = f.ValueDetection?.Confidence || 0
    if (confidence[field] !== undefined && confidence[field]! >= score) continue
    confidence[field] = score
    if (['subtotal', 'tax', 'total'].includes(field)) {
      const n = moneyField(raw)
      if (Number.isFinite(n) && n >= 0 && n <= 100_000_000_000) (fields as any)[field] = n
      else warnings.push(`Check ${field}: “${raw}” could not be read as an INR amount.`)
      if (f.Currency?.Code) {
        const currencyScore = f.Currency.Confidence || 0
        if ((confidence.currency || 0) < currencyScore) confidence.currency = currencyScore
        if (f.Currency.Code === 'INR') fields.currency = 'INR'
        else { reviewFields.add('currency'); warnings.push(`Detected currency ${f.Currency.Code}. This pilot supports INR only; do not confirm a foreign-currency invoice as INR.`) }
      }
    } else if (field === 'date' || field === 'due') {
      let value = ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) value = raw
      else { const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); if (m) { if (+m[1]! <= 12 && +m[2]! <= 12 && m[1] !== m[2]) warnings.push(`Confirm ${field}: interpreted “${raw}” as day/month/year.`); value = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` } }
      if (value && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value) fields[field] = value
      else warnings.push(`Enter ${field} manually; the printed date was “${raw}”.`)
    } else (fields as any)[field] = raw.slice(0, field === 'vendor' ? 200 : field === 'vendorAddress' ? 1000 : 100)
    if (score < REVIEW_CONFIDENCE) { warnings.push(`Check ${field}: extraction confidence is ${Math.round(score)}%.`); reviewFields.add(field) }
    else reviewFields.delete(field)
  }
  const lineItems: LineItem[] = []
  for (const group of selected.flatMap(document => document.LineItemGroups || [])) {
    for (const row of group.LineItems || []) {
      const item: LineItem = { description: '', quantity: null, unitPrice: null, amount: null, confidence: null }
      const scores: number[] = []
      for (const field of row.LineItemExpenseFields || []) {
        const kind = field.Type?.Text || ''; const raw = field.ValueDetection?.Text?.trim() || ''; const score = field.ValueDetection?.Confidence
        if (!raw) continue
        if (typeof score === 'number') scores.push(score)
        if (['ITEM', 'ITEM_DESCRIPTION', 'PRODUCT_CODE'].includes(kind) && !item.description) item.description = text(raw, 500)
        else if (kind === 'EXPENSE_ROW' && !item.description) item.description = text(raw, 500)
        else if (kind === 'QUANTITY') { const value = Number(raw.replace(/,/g, '')); if (Number.isFinite(value) && value >= 0) item.quantity = value }
        else if (kind === 'UNIT_PRICE') { const value = moneyField(raw); if (Number.isFinite(value)) item.unitPrice = value }
        else if (['PRICE', 'AMOUNT', 'TOTAL'].includes(kind)) { const value = moneyField(raw); if (Number.isFinite(value)) item.amount = value }
      }
      if (item.description || item.amount !== null || item.unitPrice !== null) {
        item.confidence = scores.length ? Math.min(...scores) : null
        lineItems.push(item)
      }
    }
  }
  if (lineItems.length) {
    fields.lineItems = lineItems
    const scores = lineItems.map(item => item.confidence).filter((score): score is number => score !== null)
    const itemConfidence = scores.length ? Math.min(...scores) : undefined
    if (itemConfidence !== undefined) confidence.lineItems = itemConfidence
    if (itemConfidence === undefined || itemConfidence < REVIEW_CONFIDENCE) reviewFields.add('lineItems')
  }
  for (const required of ['vendor', 'number', 'date', 'subtotal', 'tax', 'total'] as const) if (fields[required] === undefined || fields[required] === '') { reviewFields.add(required); warnings.push(`Enter ${required} manually; Textract did not find a reliable value.`) }
  if (!fields.due) { reviewFields.add('due'); warnings.push('No reliable due date found. Leave it blank unless the document or supplier provides one.') }
  return { fields, confidence, warnings: [...new Set(warnings)], reviewFields: [...reviewFields] }
}
