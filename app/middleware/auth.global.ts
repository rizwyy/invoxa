export default defineNuxtRouteMiddleware(async to => {
  if (['/login', '/auth/callback'].includes(to.path)) return
  const { account, load } = useAccount()
  if (!account.value) { try { await load() } catch { return navigateTo('/login') } }
  if (!account.value?.workspace && to.path !== '/onboarding') return navigateTo('/onboarding')
  if (account.value?.workspace && to.path === '/onboarding') return navigateTo('/')
})
