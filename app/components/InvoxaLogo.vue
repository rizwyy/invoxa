<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <span class="invoxa-logo" :class="{ compact }" aria-hidden="true">
    <svg class="invoxa-logo-symbol" viewBox="0 0 42 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 2.75h17.2L35 11.6V38a5.25 5.25 0 0 1-5.25 5.25H9A5.25 5.25 0 0 1 3.75 38V8A5.25 5.25 0 0 1 9 2.75Z" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round" />
      <path d="M26 3v9h9M11.5 17h13M11.5 24h10M11.5 31h8" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="31.5" cy="35.5" r="8.5" fill="var(--invoxa-logo-accent, #c2f480)" />
    </svg>
    <span class="invoxa-logo-word">invoxa<span>.</span></span>
  </span>
</template>

<style scoped>
.invoxa-logo{display:inline-flex;align-items:center;gap:10px;color:inherit;line-height:1}
.invoxa-logo-symbol{width:38px;height:42px;overflow:visible;flex:none}
.invoxa-logo-word{font-size:32px;font-weight:700;letter-spacing:-1.8px}
.invoxa-logo-word>span{color:var(--invoxa-logo-accent,#c2f480)}
.invoxa-logo.compact{gap:8px}
.invoxa-logo.compact .invoxa-logo-symbol{width:30px;height:34px}
.invoxa-logo.compact .invoxa-logo-word{font-size:26px;letter-spacing:-1.4px}
@media(max-width:760px){.invoxa-logo-symbol{width:34px;height:38px}.invoxa-logo-word{font-size:29px}}
</style>
