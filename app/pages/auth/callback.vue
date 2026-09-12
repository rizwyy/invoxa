<script setup lang="ts">
const error = ref(''); const config = useRuntimeConfig().public
onMounted(async () => {
  try {
    const route = useRoute(); const saved = JSON.parse(sessionStorage.getItem('invoxa_oauth') || 'null'); sessionStorage.removeItem('invoxa_oauth')
    if (route.query.error) throw new Error('Sign-in was cancelled or denied. Please try again.')
    if (!saved || route.query.state !== saved.state || Date.now() - saved.created > 600000 || typeof route.query.code !== 'string') throw new Error('Sign-in could not be verified. Please start again.')
    const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: config.cognitoClientId, code: route.query.code, redirect_uri: window.location.origin + '/auth/callback', code_verifier: saved.verifier })
    const tokens = await $fetch<{ access_token: string }>(`${config.cognitoDomain}/oauth2/token`, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    if (!tokens.access_token) throw new Error('No access token returned')
    sessionStorage.setItem('invoxa_access', tokens.access_token)
    window.history.replaceState({}, '', '/auth/callback')
    const { account, load } = useAccount(); await load(); await navigateTo(account.value?.workspace ? '/' : '/onboarding', { replace: true })
  } catch (e: any) { sessionStorage.removeItem('invoxa_access'); error.value = e.message || 'Unable to finish sign-in' }
})
</script>
<template><main class="auth-form"><h1>{{ error ? 'Sign-in needs another try' : 'Opening your workspace…' }}</h1><p v-if="error" class="error" role="alert">{{ error }}</p><NuxtLink v-if="error" to="/login" class="button">Back to sign-in</NuxtLink></main></template>
