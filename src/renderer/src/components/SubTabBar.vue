<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Tab } from '../stores/connection'

const props = defineProps<{
  activeTabId: string | null
  tabs: Tab[]
}>()

const emit = defineEmits<{
  select: [tabId: string, subTab: 'ssh' | 'ftp']
}>()

const { t: $t } = useI18n()

const activeTab = computed(() => props.tabs.find((t) => t.id === props.activeTabId))
</script>

<template>
  <div v-if="activeTabId && activeTab" class="subtab-bar">
    <button
      class="subtab-btn"
      :class="{ active: activeTab.subTab === 'ssh' }"
      @click="emit('select', activeTabId, 'ssh')"
    >
      <span class="status-dot" :class="activeTab.connected ? 'connected' : 'disconnected'"></span>
      {{ $t('app.subtab.ssh') }}
    </button>
    <button
      class="subtab-btn"
      :class="{ active: activeTab.subTab === 'ftp' }"
      @click="emit('select', activeTabId, 'ftp')"
    >
      <span
        class="status-dot"
        :class="activeTab.ftpConnected ? 'connected' : 'disconnected'"
      ></span>
      {{ $t('app.subtab.ftp') }}
    </button>
  </div>
</template>

<style scoped>
.subtab-bar {
  display: flex;
  align-items: center;
  background: var(--bg-mantle);
  border-bottom: 1px solid var(--border);
  min-height: 28px;
  padding: 0 8px;
  gap: 2px;
}
.subtab-btn {
  padding: 3px 10px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  border-radius: 3px;
  transition:
    color 0.15s,
    background 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.subtab-btn:hover {
  background: var(--bg-overlay);
  color: var(--text-primary);
}
.subtab-btn.active {
  background: var(--bg-overlay);
  color: var(--accent);
}
.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}
.status-dot.connected {
  background: var(--success);
}
.status-dot.disconnected {
  background: var(--danger);
}
</style>
