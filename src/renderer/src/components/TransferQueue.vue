<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTransferStore, TransferItem } from '../stores/transfer'

const {
  items,
  clearCompleted,
  clearUnseen,
  setQueueOpen,
  unseenUploads,
  unseenDownloads,
  lastActiveTab
} = useTransferStore()
const transferStore = useTransferStore()

const activeTab = ref<'upload' | 'download'>(lastActiveTab.value)

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

const pinned = ref(false)

function closeOverlay(): void {
  if (!pinned.value) emit('close')
}

function openFolder(item: TransferItem): void {
  if (item.localPath) window.api.showItemInFolder(item.localPath)
}

function pauseTransfer(item: TransferItem): void {
  window.api.pauseTransfer(item.id)
  transferStore.markPaused(item.id)
}

function resumeTransfer(item: TransferItem): void {
  window.api.resumeTransfer(item.id, item.tabId, item.remotePath, item.localPath, item.transferred, item.connectionKey)
  transferStore.markActive(item.id)
}

function cancelTransfer(item: TransferItem): void {
  window.api.cancelTransfer(item.id)
}

function retryDownload(item: TransferItem): void {
  if (item.tabId && item.remotePath) {
    window.api.retryDownload(item.tabId, item.remotePath)
  }
}

function switchTab(tab: 'upload' | 'download'): void {
  activeTab.value = tab
  lastActiveTab.value = tab
}

onMounted(() => {
  setQueueOpen(true)
  if (unseenDownloads.value > 0) {
    activeTab.value = 'download'
  } else if (unseenUploads.value > 0) {
    activeTab.value = 'upload'
  }
  clearUnseen()
})

onUnmounted(() => {
  setQueueOpen(false)
})
</script>

<template>
  <div class="queue-overlay" @click="closeOverlay"></div>
  <div class="queue-panel" :class="{ pinned }">
    <div class="queue-header">
      <div class="queue-header-left">
        <span>{{ $t('transferQueue.title') }}</span>
        <button class="queue-pin-btn" :class="{ active: pinned }" :title="$t('transferQueue.pin')" @click.stop="pinned = !pinned">📌︎</button>
      </div>
      <button class="queue-close" @click.stop="emit('close')">&times;</button>
    </div>
    <div class="queue-tabs">
      <button
        class="queue-tab"
        :class="{ active: activeTab === 'upload' }"
        @click="switchTab('upload')"
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
        @click="switchTab('download')"
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
          <polyline points="7 13 12 18 17 13" />
          <line x1="12" y1="18" x2="12" y2="3" />
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
        :class="{ completed: item.status === 'completed', error: item.status === 'error', paused: item.status === 'paused', cancelled: item.status === 'cancelled' }"
      >
        <div class="queue-item-top">
          <span class="queue-filename">{{ item.filename }}</span>
          <button
            v-if="item.status === 'active'"
            class="queue-action-btn"
            :title="$t('transferQueue.pause')"
            @click="pauseTransfer(item)"
          >⏸</button>
          <button
            v-if="item.status === 'paused'"
            class="queue-action-btn"
            :title="$t('transferQueue.resume')"
            @click="resumeTransfer(item)"
          >▶</button>
          <button
            v-if="item.status === 'active' || item.status === 'paused'"
            class="queue-cancel-btn"
            :title="$t('transferQueue.cancel')"
            @click="cancelTransfer(item)"
          >✕</button>
          <button
            v-if="item.status === 'completed' && item.type === 'download' && item.localPath"
            class="queue-folder-btn"
            :title="$t('transferQueue.openFolder')"
            @click="openFolder(item)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
              />
            </svg>
          </button>
          <button
            v-if="item.status === 'error' && item.tabId && item.remotePath"
            class="queue-retry-btn"
            :title="$t('transferQueue.retry')"
            @click="retryDownload(item)"
          >↻</button>
          <button
            v-if="item.status === 'error'"
            class="queue-cancel-btn"
            :title="$t('transferQueue.remove')"
            @click="transferStore.removeItem(item.id)"
          >✕</button>
          <button
            v-if="item.status === 'cancelled' && item.tabId && item.remotePath"
            class="queue-retry-btn"
            :title="$t('transferQueue.retry')"
            @click="retryDownload(item)"
          >↻</button>
          <button
            v-if="item.status === 'cancelled'"
            class="queue-cancel-btn"
            :title="$t('transferQueue.remove')"
            @click="transferStore.removeItem(item.id)"
          >✕</button>
        </div>
        <div class="queue-bar-track">
          <div
            class="queue-bar-fill"
            :class="{ done: item.status === 'completed', err: item.status === 'error', paused: item.status === 'paused' }"
            :style="{ width: progressPercent(item) + '%' }"
          ></div>
        </div>
        <div class="queue-meta">
          <span>{{ formatSize(item.transferred) }} / {{ formatSize(item.total) }}</span>
          <span v-if="item.status === 'active'">{{ formatSpeed(item.speed) }}</span>
          <span v-if="item.status === 'active' || item.status === 'paused'">{{ progressPercent(item) }}%</span>
          <span v-if="item.status === 'paused'" class="queue-status paused">{{ $t('transferQueue.status.paused') }}</span>
          <span v-if="item.status === 'cancelled'" class="queue-status cancelled">{{ $t('transferQueue.status.cancelled') }}</span>
          <span v-else-if="item.status === 'error'" class="err-msg">{{ $t('transferQueue.status.error') }}</span>
          <span v-else-if="item.status === 'completed'" class="queue-status done">{{
            $t('transferQueue.status.done')
          }}</span>
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
.queue-overlay {
  position: fixed;
  inset: 0;
  z-index: 998;
}

.queue-panel {
  position: absolute;
  z-index: 999;
  top: 0;
  right: 0;
  width: 340px;
  height: 100%;
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  font-size: 12px;
}

.queue-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.queue-pin-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  border-radius: 2px;
  transition: color 0.15s;
}

.queue-pin-btn:hover,
.queue-pin-btn.active {
  color: var(--accent);
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}

.queue-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
}

.queue-close:hover {
  color: var(--text-primary);
}

.queue-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
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
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.queue-tab:hover {
  color: var(--text-primary);
  background: var(--bg-overlay);
}

.queue-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-count {
  font-size: 10px;
  background: var(--bg-overlay);
  color: var(--text-muted);
  padding: 0 5px;
  border-radius: 8px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.queue-tab.active .tab-count {
  background: var(--bg-hover);
  color: var(--accent);
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
  color: var(--text-muted);
  font-size: 13px;
}

.queue-item {
  background: var(--bg-mantle);
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-item.completed,
.queue-item.cancelled {
  opacity: 0.6;
}

.queue-item.error {
  border: 1px solid var(--danger);
}

.queue-item.paused {
  opacity: 0.7;
}

.queue-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.queue-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  display: flex;
}

.queue-folder-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: 3px;
}

.queue-folder-btn:hover {
  color: var(--accent);
  background: var(--bg-overlay);
}

.queue-retry-btn {
  background: none;
  border: none;
  color: var(--danger);
  cursor: pointer;
  padding: 2px 6px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: 3px;
  font-size: 14px;
}

.queue-retry-btn:hover {
  background: color-mix(in srgb, var(--bg-base), var(--danger) 12%);
}

.queue-cancel-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 2px 6px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: 3px;
  font-size: 12px;
}

.queue-cancel-btn:hover {
  background: var(--bg-overlay);
  color: var(--text-base);
}

.queue-action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 6px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: 3px;
  font-size: 12px;
  line-height: 1;
}

.queue-action-btn:hover {
  background: var(--bg-overlay);
  color: var(--text-base);
}

.queue-filename {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.queue-status {
  font-size: 11px;
  font-weight: 600;
}

.queue-status.done {
  color: var(--success);
}

.queue-status.paused {
  color: var(--warning);
}

.queue-status.cancelled {
  color: var(--text-muted);
}

.queue-status.err {
  color: var(--danger);
}

.queue-pct {
  font-size: 11px;
  color: var(--accent);
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.queue-bar-track {
  height: 4px;
  background: var(--bg-overlay);
  border-radius: 2px;
  overflow: hidden;
}

.queue-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.queue-bar-fill.done {
  background: var(--success);
}

.queue-bar-fill.paused {
  background: var(--warning);
}

.queue-bar-fill.err {
  background: var(--danger);
}

.queue-meta {
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 11px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.err-msg {
  color: var(--danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.queue-footer {
  padding: 8px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
}

.queue-clear-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
}

.queue-clear-btn:hover {
  background: var(--bg-overlay);
  color: var(--text-primary);
}
</style>
