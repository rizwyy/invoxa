<script setup lang="ts">
import { MAX_BYTES, type Invoice } from '../../shared/domain'

const config = useRuntimeConfig().public
const api = useApi()
const file = ref<File | null>(null)
const error = ref('')
const busy = ref(false)
const stage = ref('')
const dragging = ref(false)
const invoiceId = ref('')
const limitModal = ref(false)
const { used, limit, limitReached: sessionLimitReached, load: loadUsage, recordExtractionStarted } = useTextractUsage()
const limitReached = computed(() => config.appMode === 'aws' && sessionLimitReached.value)

function openLimitModal() {
  limitModal.value = true
}

function choose(files: FileList | null) {
  if (busy.value) return
  if (limitReached.value) {
    openLimitModal()
    return
  }
  error.value = ''
  invoiceId.value = ''
  file.value = null
  const selected = files?.[0]
  if (!selected) return
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(selected.type)) {
    error.value = 'Choose a PDF, JPEG or PNG file.'
    return
  }
  if (selected.size > MAX_BYTES || !selected.size) {
    error.value = 'Choose a file between 1 byte and 8 MB.'
    return
  }
  file.value = selected
}

function dropped(event: DragEvent) {
  event.preventDefault()
  dragging.value = false
  if (limitReached.value) {
    openLimitModal()
    return
  }
  choose(event.dataTransfer?.files || null)
}

async function upload() {
  if (!file.value || busy.value) return
  if (limitReached.value) {
    openLimitModal()
    return
  }
  busy.value = true
  error.value = ''
  try {
    if (!invoiceId.value) {
      stage.value = 'Preparing secure upload…'
      const result = await api<{ invoice: Invoice; upload: { url: string; fields?: Record<string, string>; method: 'POST' | 'PUT' } }>('/uploads', {
        method: 'POST',
        body: { name: file.value.name, type: file.value.type, size: file.value.size },
      })
      stage.value = 'Uploading document…'
      let body: File | FormData = file.value
      if (result.upload.method === 'POST') {
        const form = new FormData()
        for (const [key, value] of Object.entries(result.upload.fields || {})) form.append(key, value)
        form.append('file', file.value)
        body = form
      }
      const response = await fetch(result.upload.url, {
        method: result.upload.method,
        body,
        credentials: result.upload.method === 'PUT' ? 'same-origin' : 'omit',
      })
      if (!response.ok) throw new Error('Upload failed. Check your connection and try again. The incomplete record can be archived from Invoices.')
      invoiceId.value = result.invoice.id
    }
    stage.value = config.appMode === 'local' ? 'Preparing your review…' : 'Starting automatic invoice processing…'
    const completed = await api<Invoice>(`/invoices/${invoiceId.value}/complete`, { method: 'POST', body: {} })
    if (config.appMode === 'aws' && completed.processing === 'processing' && completed.extraction?.source === 'textract') {
      recordExtractionStarted(completed.id)
    }
    await navigateTo(`/invoices/${invoiceId.value}`)
  } catch (caught: any) {
    error.value = caught.message
  } finally {
    busy.value = false
    stage.value = ''
  }
}

onMounted(() => {
  loadUsage()
  if (limitReached.value) openLimitModal()
})
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">DROP IT. INVOXA DOES THE FIRST PASS.</p>
      <h1>Process a supplier invoice</h1>
      <p>Upload one PDF or image. Invoxa turns it into a searchable invoice record.</p>
    </div>
    <span v-if="config.appMode === 'aws'" class="usage-pill" :class="{ exhausted: limitReached }">
      {{ used }} of {{ limit }} successful demo extractions used
    </span>
  </div>

  <div class="upload-layout">
    <section class="panel upload-panel">
      <label
        class="dropzone"
        :class="{ dragging, disabled: limitReached }"
        :aria-disabled="limitReached"
        @dragover.prevent="!limitReached && (dragging = true)"
        @dragleave="dragging = false"
        @drop="dropped"
      >
        <span class="upload-symbol" aria-hidden="true">{{ limitReached ? '✓' : '↑' }}</span>
        <strong>{{ limitReached ? 'Demo extraction limit reached' : file ? file.name : 'Drop an invoice here' }}</strong>
        <span>{{ limitReached ? 'Your existing invoices remain available to review.' : 'PDF, JPG or PNG · up to 8 MB · up to 10 PDF pages' }}</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png" :disabled="busy || limitReached" @change="choose(($event.target as HTMLInputElement).files)">
      </label>
      <p v-if="file" class="file-selected">{{ (file.size / 1024).toFixed(0) }} KB · {{ file.type }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="stage" role="status" class="loading">{{ stage }}</p>
      <div class="form-actions">
        <NuxtLink to="/invoices" class="button secondary">Back to invoices</NuxtLink>
        <button class="button" :disabled="!file || busy || limitReached" @click="upload">
          {{ busy ? 'Processing…' : invoiceId ? 'Retry document check' : 'Process invoice' }} →
        </button>
      </div>
      <NuxtLink v-if="invoiceId && error" :to="`/invoices/${invoiceId}`" class="text-link">Open this invoice record →</NuxtLink>
    </section>

    <aside class="upload-help">
      <p class="eyebrow">WHAT HAPPENS NEXT</p>
      <ol>
        <li><strong>Private upload</strong><p>{{ config.appMode === 'local' ? 'Your file is stored privately on this computer.' : 'The original is stored in your private S3 workspace.' }}</p></li>
        <li><strong>{{ config.appMode === 'local' ? 'Manual local preview' : 'Automatic extraction' }}</strong><p>{{ config.appMode === 'local' ? 'AWS is not connected in local mode, so you can test the review flow by entering the details.' : 'Textract reads the supplier, invoice number, dates, totals, GST and line items.' }}</p></li>
        <li><strong>Review exceptions</strong><p>{{ config.appMode === 'local' ? 'Confirm the record against the document.' : 'High-confidence fields arrive completed. Invoxa highlights only values that need your attention.' }}</p></li>
      </ol>
      <p class="muted">{{ config.appMode === 'aws' ? 'This public demo includes three successful Textract extractions per browser session.' : 'Local mode does not call Textract.' }} Use clear, upright scans. Password-protected PDFs and non-INR invoices are outside this pilot.</p>
    </aside>
  </div>

  <ExtractionLimitModal :open="limitModal" :used="used" :limit="limit" @close="limitModal = false" />
</template>
