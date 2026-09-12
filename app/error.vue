<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>
<template><main style="max-width:640px;margin:12vh auto;padding:32px"><p class="eyebrow">INVOXA · DEMO WORKSPACE</p><h1>{{ error.statusCode === 404 ? 'Invoice or page not found' : 'Something went wrong' }}</h1><p style="margin:20px 0;color:#647881">{{ error.statusCode === 404 ? 'This page isn’t part of the sample workspace.' : 'Refresh to return to the original demo data.' }}</p><button class="button" @click="clearError({ redirect: '/invoices' })">Back to invoices →</button></main></template>
