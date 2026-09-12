<script setup lang="ts">
const config = useRuntimeConfig().public
const signup = ref(false); const email = ref(''); const password = ref(''); const busy = ref(false); const error = ref('')
const { account, load } = useAccount(); const api = useApi()
async function cognitoLogin() {
  busy.value = true; error.value = ''
  try {
    if (!config.cognitoDomain || !config.cognitoClientId || !config.apiBase) throw new Error('AWS sign-in is not configured. Set the public Cognito and API environment variables.')
    const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('')
    const verifier = random(); const state = random()
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
    sessionStorage.setItem('invoxa_oauth', JSON.stringify({ verifier, state, created: Date.now() }))
    const params = new URLSearchParams({ client_id: config.cognitoClientId, response_type: 'code', redirect_uri: window.location.origin + '/auth/callback', scope: 'openid email aws.cognito.signin.user.admin', state, code_challenge: challenge, code_challenge_method: 'S256' })
    window.location.assign(`${config.cognitoDomain}/oauth2/authorize?${params}`)
  } catch (e: any) { error.value = e.message; busy.value = false }
}
async function submit() {
  busy.value = true; error.value = ''
  try { await api(signup.value ? '/auth/signup' : '/auth/login', { method: 'POST', body: { email: email.value, password: password.value } }); await load(); await navigateTo(account.value?.workspace ? '/' : '/onboarding') } catch (e: any) { error.value = e.message } finally { busy.value = false }
}
</script>
<template><div class="auth-layout"><section class="auth-story"><NuxtLink class="brand" to="/login"><span class="brand-mark">i</span>invoxa.</NuxtLink><p class="eyebrow">LESS SEARCHING. MORE CLARITY.</p><h1>Your invoices.<br>Your next payment.<br>One clear view.</h1><p>Keep supplier bills together, check their details, and track what your business owes.</p><div class="auth-note">Review comes first. Your totals include only the invoices you confirm.</div></section><section class="auth-form"><p class="eyebrow">{{ config.appMode === 'local' ? 'LOCAL WORKSPACE' : 'WELCOME TO INVOXA' }}</p><h1>{{ signup ? 'Create your account' : 'Welcome back' }}</h1><p class="form-intro">{{ config.appMode === 'local' ? 'Local testing only. Use a test email and a unique test password.' : 'Sign in securely to open your business workspace.' }}</p><p v-if="$route.query.expired" class="warning">Your session ended. Sign in again to continue.</p><form v-if="config.appMode === 'local'" @submit.prevent="submit"><label>Email<input v-model="email" type="email" autocomplete="username" required maxlength="254"></label><label>Password<input v-model="password" type="password" :autocomplete="signup ? 'new-password' : 'current-password'" minlength="12" maxlength="128" required></label><p class="muted">At least 12 characters. Local accounts do not send verification or password-reset emails.</p><button class="button" :disabled="busy" type="submit">{{ busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in' }} →</button><button type="button" class="text-link auth-toggle" @click="signup = !signup; error = ''">{{ signup ? 'Already have an account? Sign in' : 'New here? Create a test account' }}</button></form><button v-else class="button" :disabled="busy" @click="cognitoLogin">{{ busy ? 'Opening secure sign-in…' : 'Continue to secure sign-in' }} →</button><p v-if="config.appMode === 'aws'" class="form-intro">Create an account, verify your email or reset a password on the secure sign-in page.</p><p v-if="error" class="error" role="alert">{{ error }}</p></section></div></template>
