<script setup lang="ts">
// 会话列表面板 — 浮动显示已保存的连接，支持选择连接、编辑和删除

import { ref } from 'vue'
import type { SshConnection } from '../../../main/ssh/types'

defineProps<{
  sessions: SshConnection[]
}>()

const emit = defineEmits<{
  select: [session: SshConnection]
  edit: [session: SshConnection]
  delete: [id: string]
  close: []
  export: []
  import: []
  reorder: [fromIndex: number, toIndex: number]
}>()

const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(index: number): void {
  dragIndex.value = index
}

function onDragOver(index: number): void {
  if (dragIndex.value === null || dragIndex.value === index) return
  dragOverIndex.value = index
}

function onDragLeave(): void {
  dragOverIndex.value = null
}

function onDrop(index: number): void {
  if (dragIndex.value !== null && dragIndex.value !== index) {
    emit('reorder', dragIndex.value, index)
  }
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd(): void {
  dragIndex.value = null
  dragOverIndex.value = null
}
</script>

<template>
  <!-- 遮罩层：点击关闭面板 -->
  <div class="panel-overlay" @click="emit('close')"></div>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">{{ $t('sessionsPanel.title') }}</span>
      <div class="header-actions">
        <button class="header-btn" :title="$t('sessionsPanel.export')" @click="emit('export')">
          ⤊
        </button>
        <button class="header-btn" :title="$t('sessionsPanel.import')" @click="emit('import')">
          ⤋
        </button>
        <button class="close-btn" @click="emit('close')">&times;</button>
      </div>
    </div>
    <div class="panel-body">
      <!-- 空状态 -->
      <div v-if="sessions.length === 0" class="empty">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <p>{{ $t('sessionsPanel.empty') }}</p>
        <p class="hint">{{ $t('sessionsPanel.emptyHint') }}</p>
      </div>
      <!-- 会话列表 -->
      <div
        v-for="(session, index) in sessions"
        :key="session.id"
        class="session-item"
        :class="{
          'drag-over-top': dragOverIndex === index && dragIndex !== null && dragIndex > index,
          'drag-over-bottom': dragOverIndex === index && dragIndex !== null && dragIndex < index
        }"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover.prevent="onDragOver(index)"
        @dragleave="onDragLeave"
        @drop="onDrop(index)"
        @dragend="onDragEnd"
      >
        <div class="session-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <div class="session-info" @click="emit('select', session)">
          <div class="session-name">{{ session.name }}</div>
          <div class="session-detail">
            {{ session.config.username }}@{{ session.config.host }}:{{ session.config.port }}
          </div>
        </div>
        <!-- hover 显示的操作按钮 -->
        <div class="session-actions">
          <button
            class="edit-btn"
            :title="$t('sessionsPanel.edit')"
            @click.stop="emit('edit', session)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            class="delete-btn"
            :title="$t('sessionsPanel.delete')"
            @click.stop="emit('delete', session.id)"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 遮罩：覆盖整个视口，点击关闭面板 */
.panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 9;
}

/* 面板：浮动定位在 main-area 左上角，不占用布局空间 */
.panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 240px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 10;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  min-height: 36px;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.header-btn {
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

.header-btn:hover {
  color: var(--accent);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  border-radius: 2px;
}

.close-btn:hover {
  color: var(--text-primary);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
  color: var(--text-muted);
  gap: 8px;
}

.empty p {
  font-size: 13px;
  margin: 0;
}

.empty .hint {
  font-size: 11px;
  color: var(--bg-hover);
  line-height: 1.4;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.session-item:hover {
  background: var(--bg-overlay);
}

.session-item.drag-over-top {
  border-top: 2px solid var(--accent);
}

.session-item.drag-over-bottom {
  border-bottom: 2px solid var(--accent);
}

.session-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-name {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-detail {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 操作按钮：默认隐藏，hover 显示 */
.session-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.session-item:hover .session-actions {
  opacity: 1;
}

.edit-btn,
.delete-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s,
    background 0.15s;
}

.edit-btn:hover {
  color: var(--accent);
  background: var(--bg-hover);
}

.delete-btn {
  font-size: 14px;
  line-height: 1;
}

.delete-btn:hover {
  color: var(--danger);
  background: var(--bg-hover);
}
</style>
