<script setup lang="ts">
const props = defineProps<{ score?: number; review?: boolean }>()
const label = computed(() => {
  if (props.score === undefined) return props.review ? 'Needs input' : ''
  if (props.score >= 90 && !props.review) return `${Math.round(props.score)}% · High confidence`
  return `${Math.round(props.score)}% · Review`
})
</script>

<template>
  <small v-if="label" class="confidence-badge" :class="review ? 'confidence-review' : 'confidence-high'">
    <span aria-hidden="true">{{ review ? '!' : '✓' }}</span> {{ label }}
  </small>
</template>
