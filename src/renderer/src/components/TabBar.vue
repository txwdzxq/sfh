<script setup lang="ts">
// 标签栏组件 — 统一 frameless（无系统标题栏）和 system（有系统标题栏）两种模式

import { useI18n } from 'vue-i18n'
import type { Tab } from '../stores/connection'

const props = defineProps<{
  tabs: Tab[]
  activeTabId: string | null
  frameless: boolean
  dragIndex: number | null
  dragOverIndex: number | null
}>()

const emit = defineEmits<{
  select: [id: string]
  close: [id: string]
  reconnect: [id: string]
  contextmenu: [e: MouseEvent, id: string]
  wheel: [e: WheelEvent]
  dragstart: [index: number]
  dragover: [index: number]
  dragleave: []
  drop: [index: number]
  dragend: []
  'mouse-up': [id: string, e: MouseEvent]
  minimize: []
  maximize: []
  closeWindow: []
}>()

const { t } = useI18n()

/* ---- 标签页颜色 ---- */
const cachedTabColors = { primary: '', warning: '', accent: '', danger: '' }

function updateTabColors(): void {
  const s = getComputedStyle(document.documentElement)
  cachedTabColors.primary = s.getPropertyValue('--text-primary').trim()
  cachedTabColors.warning = s.getPropertyValue('--warning').trim()
  cachedTabColors.accent = s.getPropertyValue('--accent').trim()
  cachedTabColors.danger = s.getPropertyValue('--danger').trim()
}

function getTabColor(tab: Tab): string {
  if (!cachedTabColors.primary) updateTabColors()
  const { primary, warning, accent, danger } = cachedTabColors
  if (tab.connected && tab.ftpConnected) return primary
  if (tab.connected && !tab.ftpConnected) return warning
  if (!tab.connected && tab.ftpConnected) return accent
  return danger
}

function getTabTooltip(tab: Tab): string {
  const ssh = tab.connected ? t('app.connected') : t('app.disconnected')
  const ftp = tab.ftpConnected ? t('app.connected') : t('app.disconnected')
  return t('app.tabTooltip', { ssh, ftp })
}

defineExpose({ updateTabColors })
</script>

<template>
  <!-- frameless 模式：自定义标题栏 + 标签页 + 窗口控制 -->
  <div v-if="frameless" class="frameless-top">
    <div class="top-left">
      <span class="app-logo">{{ t('app.logo') }}</span>
    </div>
    <div class="titlebar-tabs frameless">
      <div class="tab-list">
        <div
          v-for="(tab, index) in tabs"
          :key="tab.id"
          class="tab"
          :class="{
            active: tab.id === activeTabId,
            dragging: dragIndex === index,
            'drag-over-left': dragIndex !== null && dragIndex !== index && dragOverIndex === index
          }"
          draggable="true"
          @click="emit('select', tab.id)"
          @mouseup="(e) => emit('mouse-up', tab.id, e)"
          @contextmenu.prevent="emit('contextmenu', $event, tab.id)"
          @wheel.prevent="emit('wheel', $event)"
          @dragstart="emit('dragstart', index)"
          @dragover.prevent="emit('dragover', index)"
          @dragleave="emit('dragleave')"
          @drop="emit('drop', index)"
          @dragend="emit('dragend')"
        >
          <span class="tab-name" :style="{ color: getTabColor(tab) }" :title="getTabTooltip(tab)">{{
            tab.name
          }}</span>
          <button
            v-if="!tab.connected && !tab.loading"
            class="tab-refresh"
            :title="t('app.subtab.reconnect')"
            @click.stop="emit('reconnect', tab.id)"
          >
            ↻
          </button>
          <button class="tab-close" @click.stop="emit('close', tab.id)">&times;</button>
        </div>
      </div>
      <div class="titlebar-controls">
        <button class="titlebar-btn" :title="t('app.titlebar.minimize')" @click="emit('minimize')">
          &#x25AC;
        </button>
        <button class="titlebar-btn" :title="t('app.titlebar.maximize')" @click="emit('maximize')">
          &#x2752;
        </button>
        <button
          class="titlebar-btn titlebar-close"
          :title="t('app.titlebar.close')"
          @click="emit('closeWindow')"
        >
          &#x2716;
        </button>
      </div>
    </div>
  </div>

  <!-- system 模式：仅标签栏 -->
  <div v-else class="titlebar-tabs" @wheel.prevent="emit('wheel', $event)">
    <div class="tab-list">
      <div
        v-for="(tab, index) in tabs"
        :key="tab.id"
        class="tab"
        :class="{
          active: tab.id === activeTabId,
          dragging: dragIndex === index,
          'drag-over-left': dragIndex !== null && dragIndex !== index && dragOverIndex === index
        }"
        draggable="true"
        @click="emit('select', tab.id)"
        @mouseup="(e) => emit('mouse-up', tab.id, e)"
        @contextmenu.prevent="emit('contextmenu', $event, tab.id)"
        @dragstart="emit('dragstart', index)"
        @dragover.prevent="emit('dragover', index)"
        @dragleave="emit('dragleave')"
        @drop="emit('drop', index)"
        @dragend="emit('dragend')"
      >
        <span class="tab-name" :style="{ color: getTabColor(tab) }" :title="getTabTooltip(tab)">{{
          tab.name
        }}</span>
        <button
          v-if="!tab.connected && !tab.loading"
          class="tab-refresh"
          :title="t('app.subtab.reconnect')"
          @click.stop="emit('reconnect', tab.id)"
        >
          ↻
        </button>
        <button class="tab-close" @click.stop="emit('close', tab.id)">&times;</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.frameless-top {
  display: flex;
  flex-direction: row;
  height: 36px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.top-left {
  width: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-mantle);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.app-logo {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.titlebar-tabs {
  display: flex;
  align-items: center;
  background: var(--bg-mantle);
  border-bottom: 1px solid var(--border);
  min-height: 36px;
  flex-shrink: 0;
}

.titlebar-tabs.frameless {
  flex: 1;
  min-width: 0;
  user-select: none;
}

.tab-list {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: 100%;
}

.tab-list::-webkit-scrollbar {
  display: none;
}

.titlebar-controls {
  display: flex;
  height: 100%;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.titlebar-btn {
  width: 40px;
  height: 100%;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.15s,
    color 0.15s;
}

.titlebar-btn:hover {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

.titlebar-btn.titlebar-close:hover {
  background: var(--danger);
  color: var(--bg-surface);
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 14px;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
  border-right: 1px solid var(--border);
  white-space: nowrap;
  user-select: none;
  min-width: 0;
  -webkit-app-region: no-drag;
}

.tab:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.tab.active {
  background: var(--bg-surface);
  color: var(--text-primary);
  border-bottom: 2px solid var(--accent);
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.tab-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  border-radius: 2px;
}

.tab-close:hover {
  background: var(--bg-overlay);
  color: var(--danger);
}

.tab-refresh {
  background: none;
  border: none;
  color: var(--bg-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 0 2px;
  line-height: 1;
  border-radius: 2px;
  transition: color 0.15s;
  flex-shrink: 0;
}

.tab-refresh:hover {
  color: var(--accent);
}

.tab.drag-over-left {
  border-left: 2px solid var(--accent);
}

.tab.dragging {
  opacity: 0.4;
}
</style>
