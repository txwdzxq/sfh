<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface StatusBarTab {
  loading: boolean
  connected: boolean
  error: string | null
  config: {
    host: string
    port: number
  }
}

defineProps<{
  tab: StatusBarTab | null
}>()

defineEmits<{
  reconnect: []
}>()

const { t: $t } = useI18n()
</script>

<template>
  <div v-if="tab && tab.loading && !tab.connected" class="status-bar">
    <span class="spinner"></span>
    {{ $t('sshSession.connecting', { host: tab.config.host, port: tab.config.port }) }}
  </div>
  <div v-else-if="tab && tab.error" class="status-bar error">
    {{ $t('sshSession.connectionFailed', { msg: tab.error }) }}
    <button
      class="status-reconnect"
      :title="$t('app.subtab.reconnect')"
      @click="$emit('reconnect')"
    >
      ↻
    </button>
  </div>
  <div v-else-if="tab && !tab.connected && !tab.loading" class="status-bar disconnected">
    {{ $t('sshSession.connectionClosed') }}
    <button
      class="status-reconnect"
      :title="$t('app.subtab.reconnect')"
      @click="$emit('reconnect')"
    >
      ↻
    </button>
  </div>
</template>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.status-bar {
  padding: 6px 12px;
  font-size: 12px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.status-bar.error {
  background: color-mix(in srgb, var(--bg-base), var(--danger) 12%);
  color: var(--danger);
}
.status-bar.disconnected {
  background: var(--bg-surface);
  color: var(--text-muted);
}
.status-reconnect {
  margin-left: auto;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
}
.status-reconnect:hover {
  background: var(--bg-overlay);
  color: var(--accent);
}
.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--bg-overlay);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
</style>
