const STORAGE_KEY = 'invoxa_textract_success_ids'
const PENDING_KEY = 'invoxa_textract_pending_ids'
const SESSION_LIMIT = 3

function readIds(key: string) {
  if (!import.meta.client) return [] as string[]
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || '[]')
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : []
  } catch {
    return []
  }
}

export function useTextractUsage() {
  const successfulIds = useState<string[]>('textract-success-ids', () => [])
  const pendingIds = useState<string[]>('textract-pending-ids', () => [])
  const loaded = useState<boolean>('textract-usage-loaded', () => false)
  const used = computed(() => Math.min(successfulIds.value.length, SESSION_LIMIT))
  const remaining = computed(() => Math.max(0, SESSION_LIMIT - used.value))
  const limitReached = computed(() => remaining.value === 0)

  function load() {
    if (loaded.value || !import.meta.client) return
    successfulIds.value = readIds(STORAGE_KEY)
    pendingIds.value = readIds(PENDING_KEY)
    loaded.value = true
  }

  function recordExtractionStarted(invoiceId: string) {
    load()
    if (!import.meta.client || pendingIds.value.includes(invoiceId) || successfulIds.value.includes(invoiceId)) return
    pendingIds.value = [...pendingIds.value, invoiceId]
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pendingIds.value))
  }

  function recordSuccessfulExtraction(invoiceId: string) {
    load()
    if (!import.meta.client || !pendingIds.value.includes(invoiceId) || successfulIds.value.includes(invoiceId)) return false
    pendingIds.value = pendingIds.value.filter(id => id !== invoiceId)
    successfulIds.value = [...successfulIds.value, invoiceId]
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pendingIds.value))
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(successfulIds.value))
    return true
  }

  function recordExtractionFailed(invoiceId: string) {
    load()
    if (!import.meta.client || !pendingIds.value.includes(invoiceId)) return
    pendingIds.value = pendingIds.value.filter(id => id !== invoiceId)
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pendingIds.value))
  }

  return { used, remaining, limit: SESSION_LIMIT, limitReached, load, recordExtractionStarted, recordSuccessfulExtraction, recordExtractionFailed }
}
