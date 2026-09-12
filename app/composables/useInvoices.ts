import type { Invoice } from '../../shared/domain'
export { money, dateLabel, invoiceStatus as status } from '../../shared/domain'
export type { Invoice } from '../../shared/domain'
export function useInvoices() {
  const invoices = useState<Invoice[]>('invoices', () => [])
  return invoices
}
export function useInvoiceData() {
  const invoices = useInvoices(); const api = useApi()
  const load = async () => { invoices.value = await api<Invoice[]>('/invoices'); return invoices.value }
  return { invoices, load }
}
