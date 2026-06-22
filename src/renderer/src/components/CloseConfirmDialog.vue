<script setup lang="ts">
const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="dialog-overlay" @click.self="emit('cancel')">
      <div class="dialog close-confirm-dialog">
        <div class="dialog-header">
          <h2>{{ $t('closeConfirm.title') }}</h2>
        </div>
        <div class="dialog-body">
          <p>{{ $t('closeConfirm.message') }}</p>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="emit('cancel')">
            {{ $t('closeConfirm.cancel') }}
          </button>
          <button class="btn-primary" @click="emit('confirm')">
            {{ $t('closeConfirm.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  margin: auto;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 360px;
  max-width: 90vw;
  color: var(--text-primary);
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.dialog-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.dialog-body {
  padding: 20px;
}

.dialog-body p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  background: transparent;
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  background: var(--accent);
  color: var(--bg-surface);
  font-weight: 500;
}

.btn-primary:hover {
  filter: brightness(1.1);
}
</style>
