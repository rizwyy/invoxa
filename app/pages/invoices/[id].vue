<script setup lang="ts">
import { emptyFields, invoiceStatus, toPaise, type Invoice } from '../../../shared/domain'

interface DraftLineItem { description: string; quantity: string; unitPrice: string; amount: string; confidence: number | null }

const route = useRoute()
const api = useApi()
const invoice = ref<Invoice | null>(null)
const draft = reactive({ ...emptyFields(), subtotal: '', tax: '', total: '', lineItems: [] as DraftLineItem[] })
const acknowledged = ref(false)
const acceptDifference = ref(false)
const dirty = ref(false)
const busy = ref(false)
const error = ref('')
const documentError = ref('')
const documentUrl = ref('')
const loaded = ref(false)
const confirmArchive = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let alive = true
let polls = 0
const slowProcessing = ref(false)

const mismatch = computed(() => toPaise(draft.subtotal) + toPaise(draft.tax) !== toPaise(draft.total))
const reviewFields = computed(() => new Set(invoice.value?.extraction?.reviewFields || []))
const exceptionCount = computed(() => reviewFields.value.size)
const needsReview = (field: string) => reviewFields.value.has(field)
const score = (field: string) => invoice.value?.extraction?.confidence[field]
const heading = computed(() => {
  if (!invoice.value) return { eyebrow: '', title: '', description: '' }
  if (invoice.value.processing === 'processing') return { eyebrow: 'AUTOMATIC EXTRACTION', title: 'Invoxa is reading your invoice', description: 'Textract is identifying the supplier, dates, totals, GST and line items.' }
  if (invoice.value.processing === 'failed') return { eyebrow: 'MANUAL REVIEW REQUIRED', title: 'Automatic extraction failed', description: 'Your original document is safe. Enter the invoice details manually while the processing configuration is checked.' }
  if (invoice.value.processing === 'rejected') return { eyebrow: 'UPLOAD REJECTED', title: 'This document could not be accepted', description: 'Archive this record and upload a supported, valid invoice document.' }
  if (invoice.value.processing === 'awaiting-upload') return { eyebrow: 'UPLOAD INCOMPLETE', title: 'Finish uploading this invoice', description: 'The invoice record exists, but its document has not been completed.' }
  if (!invoice.value.reviewed && exceptionCount.value) return { eyebrow: 'REVIEW EXCEPTIONS', title: `${exceptionCount.value} ${exceptionCount.value === 1 ? 'field needs' : 'fields need'} your attention`, description: 'The rest of the invoice is already filled in. Compare the highlighted fields with the original.' }
  if (!invoice.value.reviewed) return { eyebrow: 'READY TO CONFIRM', title: 'Invoice processed', description: 'The extracted fields passed the confidence check. Give the record one final look.' }
  return { eyebrow: 'YOUR INVOICE RECORD', title: invoice.value.vendor, description: 'The original document and confirmed searchable data stay together.' }
})

function setDraft(i: Invoice) {
  Object.assign(draft, {
    vendor: i.vendor, number: i.number, date: i.date, due: i.due, currency: i.currency, payment: i.payment, notes: i.notes,
    vendorAddress: i.vendorAddress || '', vendorTaxId: i.vendorTaxId || '', subtotal: (i.subtotal / 100).toFixed(2), tax: (i.tax / 100).toFixed(2), total: (i.total / 100).toFixed(2),
    lineItems: (i.lineItems || []).map(item => ({ description: item.description, quantity: item.quantity === null ? '' : String(item.quantity), unitPrice: item.unitPrice === null ? '' : (item.unitPrice / 100).toFixed(2), amount: item.amount === null ? '' : (item.amount / 100).toFixed(2), confidence: item.confidence })),
  })
  acknowledged.value = false
  acceptDifference.value = false
}

async function loadDocument() {
  if (!invoice.value?.file || ['awaiting-upload', 'rejected'].includes(invoice.value.processing) || documentUrl.value) return
  try {
    const result = await api<{ url: string; type: string }>(`/invoices/${route.params.id}/document`)
    const res = await fetch(result.url, { credentials: result.url.startsWith('/') ? 'same-origin' : 'omit' })
    if (!res.ok) throw new Error('Unable to load document')
    const blob = await res.blob()
    if (alive) documentUrl.value = URL.createObjectURL(new Blob([blob], { type: result.type }))
    documentError.value = ''
  } catch { documentError.value = 'The document could not be loaded. Try again.' }
}

async function refresh() {
  try {
    const i = await api<Invoice>(`/invoices/${route.params.id}`)
    if (!alive) return
    invoice.value = i
    if (!dirty.value) setDraft(i)
    await loadDocument()
    if (i.processing === 'processing' && ++polls < 30) timer = setTimeout(refresh, 4000)
    else if (i.processing === 'processing') slowProcessing.value = true
  } catch (e: any) { error.value = e.message }
  finally { loaded.value = true }
}

function optionalAmount(value: string, label: string) {
  if (!value.trim()) return null
  const result = toPaise(value)
  if (!Number.isSafeInteger(result)) throw new Error(`Enter a valid ${label} with no more than two decimal places.`)
  return result
}

function lineItemsForSave() {
  return draft.lineItems.filter(item => item.description.trim() || item.quantity.trim() || item.unitPrice.trim() || item.amount.trim()).map(item => {
    const quantity = item.quantity.trim() ? Number(item.quantity) : null
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) throw new Error('Enter a valid line-item quantity.')
    return { description: item.description, quantity, unitPrice: optionalAmount(item.unitPrice, 'unit price'), amount: optionalAmount(item.amount, 'line total'), confidence: item.confidence }
  })
}

async function save() {
  if (!invoice.value) return
  busy.value = true
  error.value = ''
  try {
    const amounts = { subtotal: toPaise(draft.subtotal), tax: toPaise(draft.tax), total: toPaise(draft.total) }
    if (Object.values(amounts).some(n => !Number.isSafeInteger(n))) throw new Error('Enter amounts with no more than two decimal places.')
    await api(`/invoices/${invoice.value.id}`, { method: 'PATCH', body: { ...draft, ...amounts, lineItems: lineItemsForSave(), version: invoice.value.version, acknowledged: acknowledged.value, acceptDifference: acceptDifference.value } })
    dirty.value = false
    await navigateTo('/invoices?saved=1')
  } catch (e: any) { error.value = e.message }
  finally { busy.value = false }
}

function addLineItem() { draft.lineItems.push({ description: '', quantity: '', unitPrice: '', amount: '', confidence: null }); dirty.value = true }
function removeLineItem(index: number) { draft.lineItems.splice(index, 1); dirty.value = true }

async function action(action: 'paid' | 'unpaid' | 'archive' | 'restore') {
  if (!invoice.value) return
  busy.value = true
  error.value = ''
  try { invoice.value = await api<Invoice>(`/invoices/${invoice.value.id}/action`, { method: 'POST', body: { action, version: invoice.value.version } }); dirty.value = false; setDraft(invoice.value); confirmArchive.value = false }
  catch (e: any) { error.value = e.message }
  finally { busy.value = false }
}

onBeforeRouteLeave(() => { if (dirty.value && !window.confirm('Discard your unsaved invoice changes?')) return false })
onMounted(refresh)
onUnmounted(() => { alive = false; clearTimeout(timer); if (documentUrl.value) URL.revokeObjectURL(documentUrl.value) })
</script>

<template>
  <NuxtLink to="/invoices" class="back-link">← Back to invoices</NuxtLink>
  <p v-if="error" class="error" role="alert">{{ error }} <button v-if="!invoice" class="text-link" @click="refresh">Retry</button></p>
  <p v-if="!loaded" class="loading" role="status">Loading invoice…</p>
  <template v-if="invoice">
    <div class="page-heading compact"><div><p class="eyebrow">{{ heading.eyebrow }}</p><h1>{{ heading.title }}</h1><p>{{ heading.description }}</p></div><span class="badge" :data-status="invoiceStatus(invoice)">{{ invoiceStatus(invoice) }}</span></div>
    <div class="record-actions"><button v-if="invoice.reviewed && !invoice.archived" class="button secondary" :disabled="busy || dirty" @click="action(invoice.payment === 'paid' ? 'unpaid' : 'paid')">Mark {{ invoice.payment === 'paid' ? 'unpaid' : 'paid' }}</button><button v-if="invoice.archived" class="button secondary" :disabled="busy" @click="action('restore')">Restore invoice</button><button v-else class="text-link" :disabled="busy || dirty" @click="confirmArchive = true">Archive invoice</button></div>
    <div v-if="confirmArchive" class="warning" role="alert"><p>Archive this invoice? It will leave your active list, totals and reminders. You can restore it later.</p><div class="button-row"><button class="button" :disabled="busy" @click="action('archive')">Yes, archive</button><button class="button secondary" @click="confirmArchive = false">Keep invoice</button></div></div>
    <p v-if="invoice.archived" class="warning">This invoice is archived. Restore it to make changes.</p>
    <p v-if="invoice.processing === 'awaiting-upload'" class="warning">This upload was not completed. Return to Upload to try again; you can archive this incomplete record.</p>
    <div v-if="invoice.processing === 'processing'" class="processing-card" role="status"><span class="processing-orbit" aria-hidden="true"></span><div><strong>{{ slowProcessing ? 'Still processing' : 'Reading invoice fields' }}</strong><p>{{ slowProcessing ? 'Extraction is taking longer than expected. You can check again or enter the details while you wait.' : 'This page updates automatically when Textract finishes.' }}</p></div><button v-if="slowProcessing" class="button secondary" @click="polls = 0; slowProcessing = false; refresh()">Check status</button></div>
    <p v-if="invoice.failure" class="warning">{{ invoice.failure }}</p>
    <div v-if="invoice.duplicate" class="duplicate-alert" role="alert"><div><strong>Possible duplicate invoice</strong><p>{{ invoice.duplicate.reason === 'same-file' ? 'This exact document was uploaded before.' : 'The supplier, invoice number and total match another record.' }}</p></div><NuxtLink :to="`/invoices/${invoice.duplicate.invoiceId}`" class="button secondary">Compare record ↗</NuxtLink></div>

    <div class="review-grid">
      <section class="document-panel" aria-label="Original document"><div class="document-toolbar"><span>{{ invoice.file?.name || 'Document' }}</span><a v-if="documentUrl" :href="documentUrl" target="_blank" rel="noopener noreferrer" class="text-link">Open document ↗</a></div><div v-if="documentUrl" class="document-view"><iframe v-if="invoice.file?.type === 'application/pdf'" :src="documentUrl" title="Original invoice PDF"></iframe><img v-else :src="documentUrl" alt="Original supplier invoice"></div><div v-else class="empty-cell"><p>{{ documentError || 'Document preview is not available yet.' }}</p><button v-if="documentError" class="button secondary" @click="loadDocument">Reload document</button></div></section>

      <form class="form-panel extraction-form" @submit.prevent="save" @input="dirty = true">
        <div class="section-heading"><div><h2>{{ invoice.reviewed ? 'Saved details' : 'Extracted details' }}</h2><p v-if="invoice.extraction?.source === 'textract'" class="muted">Filled automatically by AWS Textract</p></div><span class="muted">INR</span></div>
        <div v-if="!invoice.reviewed && invoice.processing === 'needs-review'" class="review-summary" :class="exceptionCount ? 'has-exceptions' : 'all-clear'"><strong>{{ exceptionCount ? `${exceptionCount} fields to check` : 'No low-confidence fields' }}</strong><span>{{ exceptionCount ? 'Highlighted below' : 'All extracted values scored at least 90%' }}</span></div>
        <details v-if="invoice.extraction?.warnings.length" class="extraction-details"><summary>Processing notes ({{ invoice.extraction.warnings.length }})</summary><ul class="extraction-warnings"><li v-for="warning in invoice.extraction.warnings" :key="warning">{{ warning }}</li></ul></details>
        <fieldset :disabled="busy || invoice.archived || ['awaiting-upload', 'rejected'].includes(invoice.processing)">
          <div class="fields">
            <label class="full" :class="{ 'field-review': needsReview('vendor') }">Supplier name <ConfidenceBadge :score="score('vendor')" :review="needsReview('vendor')" /><input v-model="draft.vendor" required maxlength="200"></label>
            <label :class="{ 'field-review': needsReview('number') }">Invoice number <ConfidenceBadge :score="score('number')" :review="needsReview('number')" /><input v-model="draft.number" required maxlength="100"></label>
            <label>Currency <ConfidenceBadge :score="score('currency')" :review="needsReview('currency')" /><select v-model="draft.currency"><option value="INR">INR · Indian rupee</option></select></label>
            <label :class="{ 'field-review': needsReview('date') }">Invoice date <ConfidenceBadge :score="score('date')" :review="needsReview('date')" /><input v-model="draft.date" type="date" required></label>
            <label :class="{ 'field-review': needsReview('due') }">Due date <span class="optional">(optional)</span> <ConfidenceBadge :score="score('due')" :review="needsReview('due')" /><input v-model="draft.due" type="date"></label>
            <label :class="{ 'field-review': needsReview('subtotal') }">Subtotal (₹) <ConfidenceBadge :score="score('subtotal')" :review="needsReview('subtotal')" /><input v-model="draft.subtotal" inputmode="decimal" required></label>
            <label :class="{ 'field-review': needsReview('tax') }">Tax / GST (₹) <ConfidenceBadge :score="score('tax')" :review="needsReview('tax')" /><input v-model="draft.tax" inputmode="decimal" required></label>
            <label :class="{ 'field-review': needsReview('total') }">Total (₹) <ConfidenceBadge :score="score('total')" :review="needsReview('total')" /><input v-model="draft.total" inputmode="decimal" required></label>
            <label>Payment status<select v-model="draft.payment"><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></label>
            <label class="full" :class="{ 'field-review': needsReview('vendorAddress') }">Vendor address <span class="optional">(optional)</span> <ConfidenceBadge :score="score('vendorAddress')" :review="needsReview('vendorAddress')" /><textarea v-model="draft.vendorAddress" rows="2" maxlength="1000"></textarea></label>
            <label class="full" :class="{ 'field-review': needsReview('vendorTaxId') }">Vendor GST / tax ID <span class="optional">(optional)</span> <ConfidenceBadge :score="score('vendorTaxId')" :review="needsReview('vendorTaxId')" /><input v-model="draft.vendorTaxId" maxlength="100"></label>
          </div>

          <section class="line-items-section" :class="{ 'field-review': needsReview('lineItems') }"><div class="section-heading"><div><h3>Line items</h3><p class="muted">Extracted where the invoice provides a clear item table.</p></div><ConfidenceBadge :score="score('lineItems')" :review="needsReview('lineItems')" /></div><div v-for="(item, index) in draft.lineItems" :key="index" class="line-item-row"><label class="line-description">Description<input v-model="item.description" maxlength="500"></label><label>Qty<input v-model="item.quantity" inputmode="decimal"></label><label>Unit price (₹)<input v-model="item.unitPrice" inputmode="decimal"></label><label>Amount (₹)<input v-model="item.amount" inputmode="decimal"></label><button type="button" class="line-remove" :aria-label="`Remove line item ${index + 1}`" @click="removeLineItem(index)">×</button></div><p v-if="!draft.lineItems.length" class="muted">No line items were detected. Add them only if you need item-level search.</p><button type="button" class="text-link" @click="addLineItem">+ Add line item</button></section>
          <div class="fields notes-field"><label class="full">Notes <span class="optional">(optional)</span><textarea v-model="draft.notes" rows="3" maxlength="2000" placeholder="Payment terms, rounding, or a note for later"></textarea></label></div>
          <label v-if="mismatch" class="check-label warning"><input v-model="acceptDifference" type="checkbox" required><span>Subtotal + GST differs from the total. I checked this difference against the document.</span></label>
          <label class="check-label"><input v-model="acknowledged" type="checkbox" required><span>I reviewed the highlighted exceptions and checked the invoice total against the original document.</span></label>
          <div class="form-actions"><NuxtLink to="/invoices" class="button secondary">Cancel</NuxtLink><button type="submit" class="button">{{ busy ? 'Saving…' : invoice.reviewed ? 'Save changes' : 'Confirm invoice' }} →</button></div>
        </fieldset>
        <p class="form-note">{{ dirty ? 'You have unsaved changes.' : 'Only confirmed invoices appear in your financial totals.' }}</p>
      </form>
    </div>
  </template>
</template>
