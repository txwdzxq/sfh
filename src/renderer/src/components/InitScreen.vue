<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { InitPhase } from '../composables/useAppInit'

defineProps<{
  phase: InitPhase
  initError: string | null
}>()

defineEmits<{
  retry: []
}>()

const { t: $t } = useI18n()
</script>

<template>
  <div v-if="phase === 'loading'" class="init-screen">
    <span class="init-spinner"></span>
    <span class="init-text">{{ $t('app.loading') }}</span>
  </div>
  <div v-else-if="phase === 'error'" class="init-screen init-error">
    <p class="init-error-title">{{ $t('app.initError') }}</p>
    <p class="init-error-msg">{{ initError }}</p>
    <button class="btn-primary" @click="$emit('retry')">{{ $t('app.retry') }}</button>
  </div>
</template>

<style scoped>
@keyframes init-spin {
  to {
    transform: rotate(360deg);
  }
}
.init-screen {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--bg-base);
  color: var(--text-muted);
  font-size: 14px;
}
.init-error-title {
  color: var(--danger);
  font-size: 16px;
  font-weight: 600;
}
.init-error-msg {
  color: var(--text-secondary);
  font-size: 13px;
  max-width: 400px;
  text-align: center;
  word-break: break-all;
}
.init-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--bg-overlay);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: init-spin 0.8s linear infinite;
}
.btn-primary {
  padding: 10px 20px;
  background: var(--accent);
  color: var(--bg-surface);
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.btn-primary:hover {
  filter: brightness(1.1);
}
</style>
