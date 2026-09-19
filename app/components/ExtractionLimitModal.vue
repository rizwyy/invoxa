<script setup lang="ts">
const props = defineProps<{ open: boolean; used: number; limit: number }>()
const emit = defineEmits<{ close: [] }>()
const closeButton = ref<HTMLButtonElement | null>(null)

watch(() => props.open, (open) => {
  if (open) nextTick(() => closeButton.value?.focus())
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
      <section class="limit-modal" role="dialog" aria-modal="true" aria-labelledby="limit-title" aria-describedby="limit-description">
        <button ref="closeButton" type="button" class="modal-close" aria-label="Close limit message" @click="emit('close')">×</button>
        <div class="limit-icon" aria-hidden="true">{{ limit }}</div>
        <p class="eyebrow">DEMO EXTRACTION LIMIT</p>
        <h2 id="limit-title">You’ve completed {{ used }} free Textract extractions.</h2>
        <p id="limit-description">This browser session has reached its demo allowance. You can still review, edit and organize every invoice already processed.</p>
        <p class="limit-note">The limit is intentionally lightweight and stored only in this browser session.</p>
        <div class="button-row">
          <NuxtLink to="/invoices" class="button">View existing invoices →</NuxtLink>
          <button type="button" class="button secondary" @click="emit('close')">Close</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
