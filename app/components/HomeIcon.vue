<script setup lang="ts">
withDefaults(defineProps<{ name: 'arrow' | 'upload' | 'check' | 'document' | 'search' | 'close' | 'menu' | 'plus' | 'grid' | 'clock' | 'reset' }>(), { name: 'arrow' })
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-if="name === 'arrow'" d="M5 12h14m-6-6 6 6-6 6" />
    <path v-else-if="name === 'upload'" d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    <path v-else-if="name === 'check'" d="m5 12 4 4L19 6" />
    <path v-else-if="name === 'document'" d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8m-8 4h5" />
    <template v-else-if="name === 'search'"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></template>
    <path v-else-if="name === 'close'" d="m6 6 12 12M6 18 18 6" />
    <path v-else-if="name === 'menu'" d="M4 7h16M4 12h16M4 17h16" />
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <path v-else-if="name === 'grid'" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
    <template v-else-if="name === 'clock'"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template>
    <path v-else d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
  </svg>
</template>
