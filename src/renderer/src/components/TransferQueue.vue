<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTransferStore, TransferItem } from '../stores/transfer'

const { items, addOrUpdate, markComplete, markError, clearCompleted } = useTransferStore()

const activeTab = ref<'upload' | 'download'>('upload')

const filteredItems = computed(() => items.value.filter((i) => i.type === activeTab.value))

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1048576) return (bytesPerSec / 1048576).toFixed(1) + ' MB/s'
  if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s'
  return bytesPerSec.toFixed(0) + ' B/s'
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB'
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return bytes + ' B'
}

function progressPercent(item: TransferItem): number {
  if (item.total <= 0) return 0
  return Math.min(100, Math.round((item.transferred / item.total) * 100))
}

const emit = defineEmits<{
  close: []
}>()

const cleanups: (() => void)[] = []

onMounted(() => {
  cleanups.push(
    window.api.onTransferProgress((data) => {
      addOrUpdate(data)
    })
  )
  cleanups.push(
    window.api.onTransferComplete((data) => {
      markComplete(data.id)
    })
  )
  cleanups.push(
    window.api.onTransferError((data) => {
      markError(data.id, data.error)
    })
  )
})

onUnmounted(() => {
  cleanups.forEach((fn) => fn())
})
</script>

<template>
  <div class="queue-panel">
    <div class="queue-header">
      <span>{{ $t('transferQueue.title') }}</span>
      <button class="queue-close" @click="emit('close')">&times;</button>
    </div>
    <div class="queue-tabs">
      <button
        class="queue-tab"
        :class="{ active: activeTab === 'upload' }"
        @click="activeTab = 'upload'"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {{ $t('transferQueue.tab.uploads') }}
        <span class="tab-count">{{ items.filter((i) => i.type === 'upload').length }}</span>
      </button>
      <button
        class="queue-tab"
        :class="{ active: activeTab === 'download' }"
        @click="activeTab = 'download'"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 8 12 3 17 8" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {{ $t('transferQueue.tab.downloads') }}
        <span class="tab-count">{{ items.filter((i) => i.type === 'download').length }}</span>
      </button>
    </div>
    <div class="queue-list">
      <div v-if="filteredItems.length === 0" class="queue-empty">
        {{
          activeTab === 'upload'
            ? $t('transferQueue.empty.uploads')
            : $t('transferQueue.empty.downloads')
        }}
      </div>
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="queue-item"
        :class="{ completed: item.status === 'completed', error: item.status === 'error' }"
      >
        <div class="queue-item-top">
          <span class="queue-filename">{{ item.filename }}</span>
          <span v-if="item.status === 'completed'" class="queue-status done">{{
            $t('transferQueue.status.done')
          }}</span>
          <span v-else-if="item.status === 'error'" class="queue-status err">{{
            $t('transferQueue.status.error')
          }}</span>
          <span v-else class="queue-pct">{{ progressPercent(item) }}%</span>
        </div>
        <div class="queue-bar-track">
          <div
            class="queue-bar-fill"
            :class="{ done: item.status === 'completed', err: item.status === 'error' }"
            :style="{ width: progressPercent(item) + '%' }"
          ></div>
        </div>
        <div class="queue-meta">
          <span>{{ formatSize(item.transferred) }} / {{ formatSize(item.total) }}</span>
          <span v-if="item.status === 'active'">{{ formatSpeed(item.speed) }}</span>
          <span v-else-if="item.status === 'error'" class="err-msg">{{ item.error }}</span>
        </div>
      </div>
    </div>
    <div v-if="filteredItems.length > 0" class="queue-footer">
      <button class="queue-clear-btn" @click="clearCompleted">
        {{ $t('transferQueue.clearCompleted') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.queue-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 340px;
  height: 100%;
  background: #1e1e2e;
  border-left: 1px solid #313244;
  display: flex;
  flex-direction: column;
  z-index: 20;
  font-size: 12px;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid #313244;
}

.queue-close {
  background: none;
  border: none;
  color: #6c7086;
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
}

.queue-close:hover {
  color: #cdd6f4;
}

.queue-tabs {
  display: flex;
  border-bottom: 1px solid #313244;
}

.queue-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  background: none;
  border: none;
  color: #6c7086;
  font-size: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.queue-tab:hover {
  color: #cdd6f4;
  background: #313244;
}

.queue-tab.active {
  color: #89b4fa;
  border-bottom-color: #89b4fa;
}

.tab-count {
  font-size: 10px;
  background: #313244;
  color: #6c7086;
  padding: 0 5px;
  border-radius: 8px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.queue-tab.active .tab-count {
  background: #45475a;
  color: #89b4fa;
}

.queue-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6c7086;
  font-size: 13px;
}

.queue-item {
  background: #181825;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-item.completed {
  opacity: 0.6;
}

.queue-item.error {
  border: 1px solid #f38ba8;
}

.queue-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.queue-icon {
  color: #6c7086;
  flex-shrink: 0;
  display: flex;
}

.queue-filename {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #cdd6f4;
}

.queue-status {
  font-size: 11px;
  font-weight: 600;
}

.queue-status.done {
  color: #a6e3a1;
}

.queue-status.err {
  color: #f38ba8;
}

.queue-pct {
  font-size: 11px;
  color: #89b4fa;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.queue-bar-track {
  height: 4px;
  background: #313244;
  border-radius: 2px;
  overflow: hidden;
}

.queue-bar-fill {
  height: 100%;
  background: #89b4fa;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.queue-bar-fill.done {
  background: #a6e3a1;
}

.queue-bar-fill.err {
  background: #f38ba8;
}

.queue-meta {
  display: flex;
  justify-content: space-between;
  color: #6c7086;
  font-size: 11px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.err-msg {
  color: #f38ba8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.queue-footer {
  padding: 8px;
  border-top: 1px solid #313244;
  display: flex;
  justify-content: center;
}

.queue-clear-btn {
  background: none;
  border: 1px solid #313244;
  color: #6c7086;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
}

.queue-clear-btn:hover {
  background: #313244;
  color: #cdd6f4;
}
</style>
