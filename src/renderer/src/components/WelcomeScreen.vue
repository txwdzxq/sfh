<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineEmits<{ create: [] }>()

const { t: $t } = useI18n()
</script>

<template>
  <div class="welcome">
    <div class="welcome-content">
      <h1>{{ $t('welcome.heading') }}</h1>
      <p>{{ $t('welcome.description') }}</p>
      <button class="btn-primary" @click="$emit('create')">
        {{ $t('welcome.newConnection') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.welcome-content {
  text-align: center;
}
.welcome-content h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
}
.welcome-content p {
  color: var(--text-muted);
  margin-bottom: 24px;
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
