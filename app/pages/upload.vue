<script setup lang="ts">
import { MAX_BYTES, type Invoice } from '../../shared/domain'
const config = useRuntimeConfig().public; const api = useApi(); const file = ref<File | null>(null); const error = ref(''); const busy = ref(false); const stage = ref(''); const dragging = ref(false); const invoiceId = ref('')
function choose(files: FileList | null) { if (busy.value) return; error.value = ''; invoiceId.value = ''; file.value = null; const f = files?.[0]; if (!f) return; if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) { error.value = 'Choose a PDF, JPEG or PNG file.'; return } if (f.size > MAX_BYTES || !f.size) { error.value = 'Choose a file between 1 byte and 8 MB.'; return } file.value = f }
function dropped(e: DragEvent) { e.preventDefault(); dragging.value = false; choose(e.dataTransfer?.files || null) }
async function upload() {
  if (!file.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    if (!invoiceId.value) {
      stage.value = 'Preparing secure upload…'
      const result = await api<{ invoice: Invoice; upload: { url: string; fields?: Record<string, string>; method: 'POST' | 'PUT' } }>('/uploads', { method: 'POST', body: { name: file.value.name, type: file.value.type, size: file.value.size } })
      stage.value = 'Uploading document…'
      let body: File | FormData = file.value
      if (result.upload.method === 'POST') { const form = new FormData(); for (const [key, value] of Object.entries(result.upload.fields || {})) form.append(key, value); form.append('file', file.value); body = form }
      const response = await fetch(result.upload.url, { method: result.upload.method, body, credentials: result.upload.method === 'PUT' ? 'same-origin' : 'omit' })
      if (!response.ok) throw new Error('Upload failed. Check your connection and try again. The incomplete record can be archived from Invoices.')
      invoiceId.value = result.invoice.id
    }
    stage.value = config.appMode === 'local' ? 'Preparing your review…' : 'Starting automatic invoice processing…'
    await api(`/invoices/${invoiceId.value}/complete`, { method: 'POST', body: {} })
    await navigateTo(`/invoices/${invoiceId.value}`)
  } catch (e: any) { error.value = e.message } finally { busy.value = false; stage.value = '' }
}
</script>
<template><div class="page-heading"><div><p class="eyebrow">DROP IT. INVOXA DOES THE FIRST PASS.</p><h1>Process a supplier invoice</h1><p>Upload one PDF or image. Invoxa turns it into a searchable invoice record.</p></div></div><div class="upload-layout"><section class="panel upload-panel"><label class="dropzone" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop="dropped"><span class="upload-symbol" aria-hidden="true">↑</span><strong>{{ file ? file.name : 'Drop an invoice here' }}</strong><span>PDF, JPG or PNG · up to 8 MB · up to 10 PDF pages</span><input type="file" accept="application/pdf,image/jpeg,image/png" :disabled="busy" @change="choose(($event.target as HTMLInputElement).files)"></label><p v-if="file" class="file-selected">{{ (file.size / 1024).toFixed(0) }} KB · {{ file.type }}</p><p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="stage" role="status" class="loading">{{ stage }}</p><div class="form-actions"><NuxtLink to="/invoices" class="button secondary">Back to invoices</NuxtLink><button class="button" :disabled="!file || busy" @click="upload">{{ busy ? 'Processing…' : invoiceId ? 'Retry document check' : 'Process invoice' }} →</button></div><NuxtLink v-if="invoiceId && error" :to="`/invoices/${invoiceId}`" class="text-link">Open this invoice record →</NuxtLink></section><aside class="upload-help"><p class="eyebrow">WHAT HAPPENS NEXT</p><ol><li><strong>Private upload</strong><p>{{ config.appMode === 'local' ? 'Your file is stored privately on this computer.' : 'The original is stored in your private S3 workspace.' }}</p></li><li><strong>{{ config.appMode === 'local' ? 'Manual local preview' : 'Automatic extraction' }}</strong><p>{{ config.appMode === 'local' ? 'AWS is not connected in local mode, so you can test the review flow by entering the details.' : 'Textract reads the supplier, invoice number, dates, totals, GST and line items.' }}</p></li><li><strong>Review exceptions</strong><p>{{ config.appMode === 'local' ? 'Confirm the record against the document.' : 'High-confidence fields arrive completed. Invoxa highlights only values that need your attention.' }}</p></li></ol><p class="muted">Use clear, upright scans. Password-protected PDFs and non-INR invoices are outside this pilot.</p></aside></div></template>
