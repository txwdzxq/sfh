<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick, toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from './stores/connection'
import { useSettingsStore, savedTabs } from './stores/settings'
import { useTabManager } from './composables/useTabManager'
import ConnectionDialog from './components/ConnectionDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import AboutDialog from './components/AboutDialog.vue'
import SshSession from './components/SshSession.vue'
import FtpSession from './components/FtpSession.vue'
import Sidebar from './components/Sidebar.vue'
import SessionsPanel from './components/SessionsPanel.vue'
import TransferQueue from './components/TransferQueue.vue'
import type { SshConnectionConfig, SshConnection } from '../../main/ssh/types'
import type { SftpEntry } from '../../main/ssh/types'
import type { Tab } from './stores/connection'

const { t } = useI18n()
const connectionStore = useConnectionStore()
const {
  savedConnections,
  showSessions,
  addTab,
  setActiveTab,
  setSubTab,
  moveTab,
  toggleSessions,
  closeSessions,
  loadSavedConnections,
  saveConnectionByConfig,
  updateConnection,
  deleteConnection,
  moveSavedConnection
} = connectionStore

const { sessionRefs, setSessionRef } = useTabManager()
const { tabs, activeTabId } = toRefs(connectionStore)

const showDialog = defineModel<boolean>('showDialog', { default: false })
const editSession = ref<SshConnection | null>(null)
const showSettings = ref(false)
const showAbout = ref(false)
const showQueue = ref(false)
const disconnectCleanup = ref<(() => void) | null>(null)

/** 右键菜单 */
const contextMenu = ref<{ x: number; y: number; tabId: string } | null>(null)
const menuEl = ref<HTMLElement | null>(null)
let contextMenuCleanup: (() => void) | null = null

function onTabContextMenu(e: MouseEvent, tabId: string): void {
  closeContextMenu()
  contextMenu.value = { x: e.clientX, y: e.clientY, tabId }
  nextTick(() => {
    document.addEventListener('mousedown', onDocumentMouseDown)
    contextMenuCleanup = () => document.removeEventListener('mousedown', onDocumentMouseDown)
  })
}

function closeContextMenu(): void {
  contextMenu.value = null
  contextMenuCleanup?.()
  contextMenuCleanup = null
}

function onDocumentMouseDown(e: MouseEvent): void {
  if (menuEl.value && !menuEl.value.contains(e.target as Node)) {
    closeContextMenu()
  }
}

const { state, load: loadSettings, flush: flushSettings } = useSettingsStore()
const { locale } = useI18n()

/** 预加载的 FTP 目录缓存 */
interface FtpCacheEntry {
  path: string
  entries: SftpEntry[]
}
const ftpCache = ref<Record<string, FtpCacheEntry>>({})

function toPlain<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

async function persistTabs(): Promise<void> {
  const list = tabs.value.map((t) => ({
    name: t.name,
    config: toPlain(t.config)
  }))
  savedTabs.length = 0
  savedTabs.push(...list)
  await flushSettings()
}

function openDialog(): void {
  editSession.value = null
  showDialog.value = true
}

function handleSessionEdit(session: SshConnection): void {
  editSession.value = session
  showDialog.value = true
  closeSessions()
}

async function handleConnect(config: SshConnectionConfig, name: string): Promise<void> {
  console.log(`[app] connect: ${name}`)
  addTab(config, name)
  try {
    await saveConnectionByConfig(config, name)
  } catch (e) {
    console.error('[app] save failed:', e)
  }
  showDialog.value = false
  await persistTabs()
}

async function handleUpdate(id: string, config: SshConnectionConfig, name: string): Promise<void> {
  console.log(`[app] update: ${name}`)
  try {
    await updateConnection(id, config, name)
  } catch (e) {
    console.error('[app] update failed:', e)
  }
  showDialog.value = false
}

function closeDialog(): void {
  showDialog.value = false
}

async function handleSessionSelect(session: SshConnection): Promise<void> {
  console.log(`[app] session select: ${session.name}`)
  addTab(session.config, session.name)
  closeSessions()
  await persistTabs()
}

async function handleSessionDelete(id: string): Promise<void> {
  await deleteConnection(id)
}

async function handleExport(): Promise<void> {
  const data = JSON.stringify(savedConnections, null, 2)
  await window.api.exportConnections(data)
}

async function handleImport(): Promise<void> {
  const data = await window.api.importConnections()
  if (!data || !Array.isArray(data)) return
  const connections = data as SshConnection[]
  for (const conn of connections) {
    if (conn.config && conn.name) {
      await saveConnectionByConfig(conn.config, conn.name)
    }
  }
}

async function onConnected(tab: {
  id: string
  connected: boolean
  ftpConnected: boolean
  loading: boolean
  name: string
  config: SshConnectionConfig
}): Promise<void> {
  console.log(`[app] tab connected`)
  tab.connected = true
  tab.loading = false
  if (state.settings.autoFtp && tab.name && tab.config) {
    try {
      await window.api.connectSftp(tab.id)
      tab.ftpConnected = true
      const resolved = await window.api.realpath(tab.id, '.')
      const list = await window.api.readdir(tab.id, resolved)
      const filtered = list.filter((e) => e.filename !== '.' && e.filename !== '..')
      filtered.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.filename.localeCompare(b.filename)
      })
      ftpCache.value[tab.id] = { path: resolved, entries: filtered }
    } catch (e) {
      console.error('[app] ftp preload failed:', e)
    }
  }
  // 连接成功后如果该标签是当前激活的，聚焦终端
  if (tab.id === activeTabId.value) {
    nextTick(() => sessionRefs.value[tab.id]?.focusAndFit())
  }
}

function onError(tab: { error: string | null; loading: boolean }, msg: string): void {
  console.error(`[app] tab error: ${msg}`)
  tab.error = msg
  tab.loading = false
}

function onSettings(): void {
  showSettings.value = true
}

function onAbout(): void {
  showAbout.value = true
}

function toggleQueue(): void {
  showQueue.value = !showQueue.value
}

async function handleCloseTab(id: string): Promise<void> {
  delete ftpCache.value[id]
  connectionStore.removeTab(id)
  await connectionStore.saveToDisk()
}

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
    moveTab(dragIndex.value, index)
    persistTabs()
  }
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd(): void {
  dragIndex.value = null
  dragOverIndex.value = null
}

function onTabWheel(e: WheelEvent): void {
  if (tabs.value.length < 2) return
  const curIdx = tabs.value.findIndex((t) => t.id === activeTabId.value)
  if (curIdx === -1) return
  const nextIdx = e.deltaY > 0 ? curIdx + 1 : curIdx - 1
  if (nextIdx < 0 || nextIdx >= tabs.value.length) return
  setActiveTab(tabs.value[nextIdx].id)
}

function minimizeWindow(): void {
  window.api.minimize()
}

function maximizeWindow(): void {
  window.api.maximize()
}

function closeWindow(): void {
  window.api.close()
}

onMounted(async () => {
  loadSavedConnections()
  await loadSettings()
  // 应用保存的语言设置
  locale.value = state.settings.locale || 'zh-CN'
  // 应用保存的缩放
  try {
    window.api.setZoomFactor(state.settings.zoom)
  } catch (e) {
    console.error('[app] setZoomFactor failed:', e)
  }
  if (state.settings.reopenTabs) {
    const restore = [...savedTabs]
    for (const tab of restore) {
      addTab(tab.config, tab.name)
    }
  }
  // 持久监听断开事件，更新标签连接状态
  disconnectCleanup.value = window.api.onDisconnect((e) => {
    const tab = connectionStore.tabs.value.find((t) => t.id === e.id)
    if (tab) {
      tab.connected = false
      tab.ftpConnected = false
    }
  })
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (resizeTimer) clearTimeout(resizeTimer)
  disconnectCleanup.value?.()
})

// 切换标签时自动聚焦终端
watch(activeTabId, (id) => {
  if (!id) return
  nextTick(() => sessionRefs.value[id]?.focusAndFit())
})

function getTabColor(tab: Tab) {
  const ssh = tab.connected
  const ftp = tab.ftpConnected
  if (ssh && ftp) return '#cdd6f4'
  if (ssh && !ftp) return '#f9e2af'
  if (!ssh && ftp) return '#89b4fa'
  return '#f38ba8'
}

function getTabTooltip(tab: Tab) {
  const ssh = tab.connected ? t('app.connected') : t('app.disconnected')
  const ftp = tab.ftpConnected ? t('app.connected') : t('app.disconnected')
  return t('app.tabTooltip', { ssh, ftp })
}

async function reconnectTab(tabId: string): Promise<void> {
  const tab = tabs.value.find((t) => t.id === tabId)
  if (!tab || (tab.connected && tab.ftpConnected)) return
  tab.loading = true
  tab.error = null
  window.api.disconnect(tabId)
  try {
    await window.api.connect(tabId, { ...tab.config })
    tab.connected = true
  } catch (err: unknown) {
    tab.connected = false
    tab.loading = false
    tab.error = err instanceof Error ? err.message : String(err)
    return
  }
  try {
    await window.api.connectSftp(tabId)
    tab.ftpConnected = true
    const resolved = await window.api.realpath(tabId, '.')
    const list = await window.api.readdir(tabId, resolved)
    const filtered = list.filter((e) => e.filename !== '.' && e.filename !== '..')
    filtered.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.filename.localeCompare(b.filename)
    })
    ftpCache.value[tabId] = { path: resolved, entries: filtered }
  } catch {
    tab.ftpConnected = false
  }
  tab.loading = false
}

/** 窗口尺寸提示 */
const windowSize = ref({ w: window.innerWidth, h: window.innerHeight })
const showSize = ref(false)
let resizeTimer: ReturnType<typeof setTimeout> | null = null
const onResize = (): void => {
  windowSize.value = { w: window.innerWidth, h: window.innerHeight }
  showSize.value = true
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => { showSize.value = false }, 500)
}

/** 缩放预览（拖拽时浮动浮窗） */
const previewZoom = ref<number | null>(null)
const appTransform = computed(() => {
  if (previewZoom.value === null) return {}
  const current = state.settings.zoom || 1
  const ratio = previewZoom.value / current
  return {
    transform: `scale(${ratio})`,
    'transform-origin': 'top left',
    overflow: 'visible'
  }
})
function onZoomDrag(factor: number): void {
  previewZoom.value = factor
}
function onZoomApply(factor: number): void {
  try { window.api.setZoomFactor(factor) } catch (e) { console.error('[app] setZoomFactor failed:', e) }
  previewZoom.value = null
}
</script>

<template>
  <div class="app" :style="appTransform">
    <!-- 标签栏：无系统标题栏时与标题栏合并 -->
    <div v-if="!state.settings.useSystemTitleBar" class="frameless-top">
      <div class="top-left">
        <span class="app-logo">{{ $t('app.logo') }}</span>
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
            @click="setActiveTab(tab.id)"
            @mouseup="
              (e) => {
                if ((e as MouseEvent).button === 1) handleCloseTab(tab.id)
              }
            "
            @contextmenu.prevent="onTabContextMenu($event, tab.id)"
            @wheel.prevent="onTabWheel"
            @dragstart="onDragStart(index)"
            @dragover.prevent="onDragOver(index)"
            @dragleave="onDragLeave"
            @drop="onDrop(index)"
            @dragend="onDragEnd"
          >
            <span
              class="tab-name"
              :style="{ color: getTabColor(tab) }"
              :title="getTabTooltip(tab)"
              >{{ tab.name }}</span
            >
            <button
              v-if="!tab.connected"
              class="tab-refresh"
              :class="{ spinning: tab.loading }"
              :title="$t('app.subtab.reconnect')"
              @click.stop="reconnectTab(tab.id)"
            >
              ↻
            </button>
            <button class="tab-close" @click.stop="handleCloseTab(tab.id)">&times;</button>
          </div>
        </div>
        <div class="titlebar-controls">
          <button class="titlebar-btn" :title="$t('app.titlebar.minimize')" @click="minimizeWindow">
            &#x2014;
          </button>
          <button class="titlebar-btn" :title="$t('app.titlebar.maximize')" @click="maximizeWindow">
            &#x25A1;
          </button>
          <button
            class="titlebar-btn titlebar-close"
            :title="$t('app.titlebar.close')"
            @click="closeWindow"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
    <div v-else class="titlebar-tabs" @wheel.prevent="onTabWheel">
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
          @click="setActiveTab(tab.id)"
          @mouseup="(e) => { if ((e as MouseEvent).button === 1) handleCloseTab(tab.id) }"
          @contextmenu.prevent="onTabContextMenu($event, tab.id)"
          @dragstart="onDragStart(index)"
          @dragover.prevent="onDragOver(index)"
          @dragleave="onDragLeave"
          @drop="onDrop(index)"
          @dragend="onDragEnd"
        >
          <span class="tab-name" :style="{ color: getTabColor(tab) }" :title="getTabTooltip(tab)">{{
            tab.name
          }}</span>
          <button
            v-if="!tab.connected"
            class="tab-refresh"
            :class="{ spinning: tab.loading }"
            :title="$t('app.subtab.reconnect')"
            @click.stop="reconnectTab(tab.id)"
          >
            ↻
          </button>
          <button class="tab-close" @click.stop="handleCloseTab(tab.id)">&times;</button>
        </div>
      </div>
    </div>
    <!-- 右键菜单 -->
    <div
      v-if="contextMenu"
      ref="menuEl"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div
        class="context-menu-item"
        @click="reconnectTab(contextMenu.tabId); closeContextMenu()"
      >
        {{ $t('app.tabContextMenu.reload') }}
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item context-menu-close" @click="closeContextMenu()">
        {{ $t('app.tabContextMenu.close') }}
      </div>
    </div>
    <div class="app-body">
      <Sidebar
        :show-dialog="showDialog"
        :sessions-active="showSessions"
        :queue-active="showQueue"
        @new-connection="openDialog"
        @sessions="toggleSessions"
        @queue="toggleQueue"
        @settings="onSettings"
        @about="onAbout"
      />
      <div class="main-area">
        <SessionsPanel
          v-if="showSessions"
          :sessions="savedConnections"
          @select="handleSessionSelect"
          @edit="handleSessionEdit"
          @delete="handleSessionDelete"
          @close="closeSessions"
          @export="handleExport"
          @import="handleImport"
          @reorder="moveSavedConnection"
        />
        <TransferQueue v-if="showQueue" @close="showQueue = false" />
        <!-- 子标签栏 -->
        <div v-if="activeTabId && tabs.find((t) => t.id === activeTabId)" class="subtab-bar">
          <button
            class="subtab-btn"
            :class="{ active: tabs.find((t) => t.id === activeTabId)?.subTab === 'ssh' }"
            @click="setSubTab(activeTabId, 'ssh')"
          >
            <span
              class="status-dot"
              :class="
                tabs.find((t) => t.id === activeTabId)?.connected ? 'connected' : 'disconnected'
              "
            ></span>
            {{ $t('app.subtab.ssh') }}
          </button>
          <button
            class="subtab-btn"
            :class="{ active: tabs.find((t) => t.id === activeTabId)?.subTab === 'ftp' }"
            @click="setSubTab(activeTabId, 'ftp')"
          >
            <span
              class="status-dot"
              :class="
                tabs.find((t) => t.id === activeTabId)?.ftpConnected ? 'connected' : 'disconnected'
              "
            ></span>
            {{ $t('app.subtab.ftp') }}
          </button>
        </div>
        <div class="content">
          <div v-if="tabs.length === 0" class="welcome">
            <div class="welcome-content">
              <h1>{{ $t('welcome.heading') }}</h1>
              <p>{{ $t('welcome.description') }}</p>
              <button class="btn-primary" @click="openDialog">
                {{ $t('welcome.newConnection') }}
              </button>
            </div>
          </div>
          <div
            v-for="tab in tabs"
            v-show="tab.id === activeTabId"
            :key="tab.id"
            class="session-wrapper"
          >
            <SshSession
              v-show="tab.subTab === 'ssh'"
              :ref="(el) => setSessionRef(tab.id, el)"
              :tab-id="tab.id"
              :config="tab.config"
              @connected="onConnected(tab)"
              @error="(msg) => onError(tab, msg)"
            />
            <FtpSession
              v-if="tab.subTab === 'ftp'"
              :tab-id="tab.id"
              :initial-path="ftpCache[tab.id]?.path"
              :initial-entries="ftpCache[tab.id]?.entries"
              @loaded="(data) => (ftpCache[tab.id] = data)"
            />
          </div>
        </div>
      </div>
    </div>
    <ConnectionDialog
      v-if="showDialog"
      :edit-session="editSession"
      @connect="handleConnect"
      @update="handleUpdate"
      @close="closeDialog"
    />
    <SettingsDialog
      v-if="showSettings"
      @close="showSettings = false"
      @zoom-drag="onZoomDrag"
      @zoom-apply="onZoomApply"
    />
    <AboutDialog v-if="showAbout" @close="showAbout = false" />
    <transition name="fade">
      <div v-if="showSize" class="resize-overlay">
        {{ windowSize.w }} &times; {{ windowSize.h }}
      </div>
    </transition>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  overflow: hidden;
  background: #11111b;
  color: #cdd6f4;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #11111b;
}

.titlebar-tabs {
  display: flex;
  align-items: center;
  background: #181825;
  border-bottom: 1px solid #313244;
  min-height: 36px;
  flex-shrink: 0;
}

.titlebar-tabs.frameless {
  flex: 1;
  min-width: 0;
  user-select: none;
}

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
  background: #181825;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
}

.app-logo {
  font-size: 13px;
  font-weight: 600;
  color: #89b4fa;
}

.tab-list {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: 100%;
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
  color: #6c7086;
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
  background: #313244;
  color: #cdd6f4;
}

.titlebar-btn.titlebar-close:hover {
  background: #f38ba8;
  color: #1e1e2e;
}

.app-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.tab-list::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 14px;
  font-size: 13px;
  color: #6c7086;
  cursor: pointer;
  border-right: 1px solid #313244;
  white-space: nowrap;
  user-select: none;
  min-width: 0;
  -webkit-app-region: no-drag;
}

.tab:hover {
  background: #1e1e2e;
  color: #cdd6f4;
}

.tab.active {
  background: #1e1e2e;
  color: #cdd6f4;
  border-bottom: 2px solid #89b4fa;
}

.tab-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6c7086;
  flex-shrink: 0;
}

.tab-indicator.connected {
  background: #a6e3a1;
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.tab-close {
  background: none;
  border: none;
  color: #6c7086;
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  border-radius: 2px;
}

.tab-close:hover {
  background: #313244;
  color: #f38ba8;
}

.tab.drag-over-left {
  border-left: 2px solid #89b4fa;
}

.tab.dragging {
  opacity: 0.4;
}

.context-menu {
  position: fixed;
  z-index: 10000;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.context-menu-item {
  padding: 6px 16px;
  font-size: 13px;
  color: #cdd6f4;
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
}

.context-menu-item:hover {
  background: #313244;
  color: #89b4fa;
}

.context-menu-separator {
  height: 1px;
  background: #313244;
  margin: 4px 0;
}

.context-menu-close {
  color: #6c7086;
  font-size: 12px;
}

.context-menu-close:hover {
  color: #f38ba8;
  background: #313244;
}

.subtab-bar {
  display: flex;
  align-items: center;
  background: #181825;
  border-bottom: 1px solid #313244;
  min-height: 28px;
  padding: 0 8px;
  gap: 2px;
}

.subtab-btn {
  padding: 3px 10px;
  border: none;
  background: none;
  color: #6c7086;
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
  background: #313244;
  color: #cdd6f4;
}

.subtab-btn.active {
  background: #313244;
  color: #89b4fa;
}

.tab-refresh {
  background: none;
  border: none;
  color: #585b70;
  cursor: pointer;
  font-size: 11px;
  padding: 0 2px;
  line-height: 1;
  border-radius: 2px;
  transition: color 0.15s;
  flex-shrink: 0;
}

.tab-refresh:hover {
  color: #89b4fa;
}

.tab-refresh.spinning {
  animation: spin 1s linear infinite;
  cursor: default;
  color: #89b4fa;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
  background: #a6e3a1;
}

.status-dot.disconnected {
  background: #f38ba8;
}

.content {
  flex: 1;
  overflow: hidden;
}

.session-wrapper {
  height: 100%;
}

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
  color: #6c7086;
  margin-bottom: 24px;
}

.btn-primary {
  padding: 10px 20px;
  background: #89b4fa;
  color: #1e1e2e;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover {
  background: #b4d0fb;
}

.resize-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(30, 30, 46, 0.85);
  border: 1px solid #45475a;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  color: #cdd6f4;
  pointer-events: none;
  z-index: 9999;
  white-space: nowrap;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

</style>
