<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from './stores/connection'
import { useSettingsStore } from './stores/settings'
import { useTransferStore } from './stores/transfer'
import './assets/themes.css'
import { useTabManager } from './composables/useTabManager'
import { useAppInit } from './composables/useAppInit'
import { useFtpCache } from './composables/useFtpCache'
import { useTabDrag } from './composables/useTabDrag'
import { useTabContextMenu } from './composables/useTabContextMenu'
import { useZoomPreview } from './composables/useZoomPreview'
import { useResizeOverlay } from './composables/useResizeOverlay'
import { useWindowControls } from './composables/useWindowControls'
import { useTabPersistence } from './composables/useTabPersistence'
import ConnectionDialog from './components/ConnectionDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import AboutDialog from './components/AboutDialog.vue'
import SshSession from './components/SshSession.vue'
import FtpSession from './components/FtpSession.vue'
import Sidebar from './components/Sidebar.vue'
import SessionsPanel from './components/SessionsPanel.vue'
import TransferQueue from './components/TransferQueue.vue'
import CloseConfirmDialog from './components/CloseConfirmDialog.vue'
import type { SshConnectionConfig, SshConnection } from '../../main/ssh/types'
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
  saveConnectionByConfig,
  updateConnection,
  deleteConnection,
  moveSavedConnection
} = connectionStore

const { sessionRefs, setSessionRef } = useTabManager()
const { tabs, activeTabId } = connectionStore
const settingsStore = useSettingsStore()
const { useSystemTitleBar } = settingsStore
const { addOrUpdate, markComplete, markError, hasActive, restoreQueue, markCancelled, lastActiveTab } = useTransferStore()

// 对话框
const showDialog = defineModel<boolean>('showDialog', { default: false })
const editSession = ref<SshConnection | null>(null)
const showSettings = ref(false)
const showAbout = ref(false)
const showQueue = ref(false)
const disconnectCleanup = ref<(() => void) | null>(null)
const transferCleanups: (() => void)[] = []

interface FlyParticle {
  id: number
  x: number
  y: number
  filename: string
}
let particleId = 0
const flyParticles = ref<FlyParticle[]>([])

function onDownloadStart(x: number, y: number, filename: string): void {
  const particle: FlyParticle = { id: ++particleId, x, y, filename }
  if (flyParticles.value.length >= 2) flyParticles.value.shift()
  flyParticles.value.push(particle)
  nextTick(() => animateParticle(particle))
}

function onShowQueue(): void {
  if (settingsStore.showQueueOnDownload.value) {
    lastActiveTab.value = 'download'
    showQueue.value = true
  }
}

function animateParticle(p: FlyParticle): void {
  const el = document.getElementById('fly-' + p.id)
  if (!el) return
  const btn = document.querySelector<HTMLElement>('[data-queue-btn]')
  if (!btn) return
  const targetRect = btn.getBoundingClientRect()
  const dx = targetRect.left + targetRect.width / 2 - p.x
  const dy = targetRect.top + targetRect.height / 2 - p.y
  const midX = dx * 0.5
  const midY = dy * 0.3
  el.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${midX}px, ${midY}px) scale(0.7)`, opacity: 0.8 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 }
    ],
    { duration: 500, easing: 'ease-out', fill: 'forwards' }
  ).onfinish = () => {
    flyParticles.value = flyParticles.value.filter((fp) => fp.id !== p.id)
  }
}

// Composables
const { ftpCache, handleFtpPreload, removeCache } = useFtpCache()
const { contextMenu, openContextMenu, closeContextMenu } = useTabContextMenu()
const { dragIndex, dragOverIndex, onDragStart, onDragOver, onDragLeave, doDrop, onDragEnd } =
  useTabDrag()
const { appTransform, onZoomDrag, onZoomApply } = useZoomPreview(() => settingsStore.zoom.value)
const { windowSize, showSize, onResize, cleanup: resizeCleanup } = useResizeOverlay()
const { persistTabs } = useTabPersistence()
const {
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  confirmClose,
  cancelClose,
  pendingClose,
  onBeforeUnload
} = useWindowControls(persistTabs, hasActive, () => window.api.cancelAllTransfers())

const { phase, initError, init: initApp, applyTheme } = useAppInit()

const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) || null)

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
  const data = JSON.stringify(savedConnections.value, null, 2)
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
  if (settingsStore.autoFtp.value && tab.name && tab.config) {
    const ok = await handleFtpPreload(tab.id)
    if (ok) tab.ftpConnected = true
  }
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
  removeCache(id)
  connectionStore.removeTab(id)
  await connectionStore.saveToDisk()
}

async function closeTabsToLeft(id: string): Promise<void> {
  const idx = tabs.value.findIndex((t) => t.id === id)
  if (idx <= 0) return
  const toClose = tabs.value.slice(0, idx)
  for (const tab of toClose) {
    removeCache(tab.id)
    connectionStore.removeTab(tab.id)
  }
  await connectionStore.saveToDisk()
}

async function closeTabsToRight(id: string): Promise<void> {
  const idx = tabs.value.findIndex((t) => t.id === id)
  if (idx === -1 || idx >= tabs.value.length - 1) return
  const toClose = tabs.value.slice(idx + 1)
  for (const tab of toClose) {
    removeCache(tab.id)
    connectionStore.removeTab(tab.id)
  }
  await connectionStore.saveToDisk()
}

async function closeAllTabs(): Promise<void> {
  const allIds = tabs.value.map((t) => t.id)
  for (const id of allIds) {
    removeCache(id)
    connectionStore.removeTab(id)
  }
  await connectionStore.saveToDisk()
}

function onTabWheel(e: WheelEvent): void {
  if (tabs.value.length < 2) return
  const curIdx = tabs.value.findIndex((t) => t.id === activeTabId.value)
  if (curIdx === -1) return
  const nextIdx = e.deltaY > 0 ? curIdx + 1 : curIdx - 1
  if (nextIdx < 0 || nextIdx >= tabs.value.length) return
  setActiveTab(tabs.value[nextIdx].id)
}

onMounted(async () => {
  await initApp()
  if (settingsStore.savedTransfers.value.length > 0) {
    restoreQueue(settingsStore.savedTransfers.value)
  }
  disconnectCleanup.value = window.api.onDisconnect((e) => {
    const tab = connectionStore.tabs.value.find((t) => t.id === e.id)
    if (tab) {
      tab.connected = false
      tab.ftpConnected = false
    }
  })
  transferCleanups.push(
    window.api.onTransferProgress((data) => addOrUpdate(data)),
    window.api.onTransferComplete((data) => markComplete(data.id, data.localPath)),
    window.api.onTransferError((data) => markError(data.id, data.error)),
    window.api.onTransferCancelled((data) => markCancelled(data.id))
  )
  window.addEventListener('resize', onResize)
  window.addEventListener('beforeunload', onBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('beforeunload', onBeforeUnload)
  resizeCleanup()
  disconnectCleanup.value?.()
  transferCleanups.forEach((fn) => fn())
})

watch(
  () => settingsStore.theme.value,
  (val) => {
    if (val) applyTheme(val)
  }
)

watch(activeTabId, (id) => {
  if (!id) return
  nextTick(() => sessionRefs.value[id]?.focusAndFit())
})

function getTabColor(tab: Tab): string {
  const s = getComputedStyle(document.documentElement)
  const ssh = tab.connected
  const ftp = tab.ftpConnected
  if (ssh && ftp) return s.getPropertyValue('--text-primary').trim()
  if (ssh && !ftp) return s.getPropertyValue('--warning').trim()
  if (!ssh && ftp) return s.getPropertyValue('--accent').trim()
  return s.getPropertyValue('--danger').trim()
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
</script>

<template>
  <div v-if="phase === 'loading'" class="init-screen">
    <span class="init-spinner"></span>
    <span class="init-text">{{ $t('app.loading') }}</span>
  </div>
  <div v-else-if="phase === 'error'" class="init-screen init-error">
    <p class="init-error-title">{{ $t('app.initError') }}</p>
    <p class="init-error-msg">{{ initError }}</p>
    <button class="btn-primary" @click="initApp()">{{ $t('app.retry') }}</button>
  </div>
  <div v-else class="app" :style="appTransform">
    <!-- 标签栏：无系统标题栏时与标题栏合并 -->
    <div v-if="!useSystemTitleBar" class="frameless-top">
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
            @contextmenu.prevent="openContextMenu($event, tab.id)"
            @wheel.prevent="onTabWheel"
            @dragstart="onDragStart(index)"
            @dragover.prevent="onDragOver(index)"
            @dragleave="onDragLeave"
            @drop="doDrop(index, moveTab, persistTabs)"
            @dragend="onDragEnd"
          >
            <span
              class="tab-name"
              :style="{ color: getTabColor(tab) }"
              :title="getTabTooltip(tab)"
              >{{ tab.name }}</span
            >
            <button
              v-if="!tab.connected && !tab.loading"
              class="tab-refresh"
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
            &#x25AC;
          </button>
          <button class="titlebar-btn" :title="$t('app.titlebar.maximize')" @click="maximizeWindow">
            &#x2752;
          </button>
          <button
            class="titlebar-btn titlebar-close"
            :title="$t('app.titlebar.close')"
            @click="closeWindow"
          >
            &#x2716;
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
          @mouseup="
            (e) => {
              if ((e as MouseEvent).button === 1) handleCloseTab(tab.id)
            }
          "
          @contextmenu.prevent="openContextMenu($event, tab.id)"
          @dragstart="onDragStart(index)"
          @dragover.prevent="onDragOver(index)"
          @dragleave="onDragLeave"
          @drop="doDrop(index, moveTab, persistTabs)"
          @dragend="onDragEnd"
        >
          <span class="tab-name" :style="{ color: getTabColor(tab) }" :title="getTabTooltip(tab)">{{
            tab.name
          }}</span>
          <button
            v-if="!tab.connected && !tab.loading"
            class="tab-refresh"
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
        @click="
          () => {
            if (!contextMenu) return
            reconnectTab(contextMenu.tabId)
            closeContextMenu()
          }
        "
      >
        {{ $t('app.tabContextMenu.reload') }}
      </div>
      <div class="context-menu-separator"></div>
      <div
        class="context-menu-item"
        @click="
          () => {
            if (!contextMenu) return
            closeTabsToLeft(contextMenu.tabId)
            closeContextMenu()
          }
        "
      >
        {{ $t('app.tabContextMenu.closeLeft') }}
      </div>
      <div
        class="context-menu-item"
        @click="
          () => {
            if (!contextMenu) return
            closeTabsToRight(contextMenu.tabId)
            closeContextMenu()
          }
        "
      >
        {{ $t('app.tabContextMenu.closeRight') }}
      </div>
      <div
        class="context-menu-item"
        @click="
          () => {
            closeAllTabs()
            closeContextMenu()
          }
        "
      >
        {{ $t('app.tabContextMenu.closeAll') }}
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
        <div v-if="activeTab && activeTab.loading && !activeTab.connected" class="status-bar">
          <span class="spinner"></span>
          {{
            $t('sshSession.connecting', {
              host: activeTab.config.host,
              port: activeTab.config.port
            })
          }}
        </div>
        <div v-else-if="activeTab && activeTab.error" class="status-bar error">
          {{ $t('sshSession.connectionFailed', { msg: activeTab.error }) }}
          <button
            class="status-reconnect"
            :title="$t('app.subtab.reconnect')"
            @click="reconnectTab(activeTab.id)"
          >
            ↻
          </button>
        </div>
        <div
          v-else-if="activeTab && !activeTab.connected && !activeTab.loading"
          class="status-bar disconnected"
        >
          {{ $t('sshSession.connectionClosed') }}
          <button
            class="status-reconnect"
            :title="$t('app.subtab.reconnect')"
            @click="reconnectTab(activeTab.id)"
          >
            ↻
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
              @download-start="(x, y, filename) => onDownloadStart(x, y, filename)"
              @show-queue="onShowQueue"
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
    <CloseConfirmDialog v-if="pendingClose" @confirm="confirmClose" @cancel="cancelClose" />
    <transition name="fade">
      <div v-if="showSize" class="resize-overlay">
        {{ windowSize.w }} &times; {{ windowSize.h }}
      </div>
    </transition>
    <Teleport to="body">
      <span
        v-for="p in flyParticles"
        :id="'fly-' + p.id"
        :key="p.id"
        class="fly-particle"
        :style="{ left: p.x + 'px', top: p.y + 'px' }"
        >{{ p.filename }}</span
      >
    </Teleport>
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
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
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

.tab-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.tab-indicator.connected {
  background: var(--success);
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

.tab.drag-over-left {
  border-left: 2px solid var(--accent);
}

.tab.dragging {
  opacity: 0.4;
}

.context-menu {
  position: fixed;
  z-index: 10000;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.context-menu-item {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
}

.context-menu-item:hover {
  background: var(--bg-overlay);
  color: var(--accent);
}

.context-menu-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.context-menu-close {
  color: var(--text-muted);
  font-size: 12px;
}

.context-menu-close:hover {
  color: var(--danger);
  background: var(--bg-overlay);
}

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
  background: var(--success);
}

.status-dot.disconnected {
  background: var(--danger);
}

.content {
  flex: 1;
  overflow: hidden;
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

.resize-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(30, 30, 46, 0.85);
  border: 1px solid var(--bg-hover);
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-primary);
  pointer-events: none;
  z-index: 9999;
  white-space: nowrap;
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

@keyframes init-spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fly-particle {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  font-size: 12px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  color: var(--accent);
  white-space: nowrap;
  will-change: transform, opacity;
}
</style>
