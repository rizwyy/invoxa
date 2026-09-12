<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>
<template><main style="max-width:640px;margin:12vh auto;padding:32px"><p class="eyebrow">INVOXA</p><h1>{{ error.statusCode === 404 ? 'Invoice or page not found' : 'Something went wrong' }}</h1><p style="margin:20px 0;color:#647881">{{ error.statusCode === 404 ? 'We couldn’t find the page you were looking for.' : 'Please try again or return to the homepage.' }}</p><button class="button" @click="clearError({ redirect: '/' })">Back to homepage →</button></main></template>
