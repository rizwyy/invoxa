import tailwindcss from '@tailwindcss/vite'
export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  ssr: false,
  runtimeConfig: { public: { appMode: 'local', apiBase: '', cognitoDomain: '', cognitoClientId: '' } },
  routeRules: { '/**': { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' } } },
  devtools: { enabled: false },
  ...(process.env.INVOXA_NUXT_BUILD_DIR ? { buildDir: process.env.INVOXA_NUXT_BUILD_DIR } : {}),
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()], cacheDir: process.env.INVOXA_VITE_CACHE_DIR || 'node_modules/.cache/vite' },
  app: { head: { title: 'Invoxa · Invoice workspace', meta: [{ name: 'description', content: 'Automated supplier-invoice processing with AWS Textract and human review.' }] } },
})
