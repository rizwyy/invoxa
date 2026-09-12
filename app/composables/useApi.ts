export function useApi() {
  const config = useRuntimeConfig().public
  const route = useRoute(); const router = useRouter(); const account = useState<any>('account', () => null); const invoices = useInvoices()
  return async <T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT'; body?: any } = {}): Promise<T> => {
    const headers: Record<string, string> = {}
    if (config.appMode === 'aws' && import.meta.client) {
      const token = sessionStorage.getItem('invoxa_access')
      if (token) headers.Authorization = `Bearer ${token}`
    }
    try { return await $fetch<T>(`${config.appMode === 'aws' ? config.apiBase : '/api'}${path}`, { ...options, headers, credentials: config.appMode === 'aws' ? 'omit' : 'same-origin' }) as T }
    catch (e: any) { if (e.status === 401 && import.meta.client) { sessionStorage.removeItem('invoxa_access'); account.value = null; invoices.value = []; if (!path.startsWith('/auth/') && route.path !== '/login') await router.push('/login?expired=1') } throw new Error(e.data?.message || e.data?.statusMessage || 'Unable to complete the request. Please try again.') }
  }
}
