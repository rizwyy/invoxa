import type { Identity, Workspace } from '../../shared/domain'
export function useAccount() {
  const account = useState<{ user: Identity; workspace: Workspace | null } | null>('account', () => null)
  const api = useApi(); const config = useRuntimeConfig().public; const router = useRouter(); const invoices = useInvoices()
  const load = async () => { account.value = await api('/me'); return account.value }
  const logout = async () => {
    if (config.appMode === 'local') await api('/auth/logout', { method: 'POST', body: {} })
    if (import.meta.client) sessionStorage.removeItem('invoxa_access')
    account.value = null
    invoices.value = []
    if (config.appMode === 'aws') { window.location.assign(`${config.cognitoDomain}/logout?client_id=${encodeURIComponent(config.cognitoClientId)}&logout_uri=${encodeURIComponent(window.location.origin + '/login')}`); return }
    await router.push('/login')
  }
  return { account, load, logout }
}
