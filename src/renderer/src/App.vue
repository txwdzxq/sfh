<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
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
import LocalInputBar from './components/LocalInputBar.vue'
import TabBar from './components/TabBar.vue'
import TabContextMenu from './components/TabContextMenu.vue'
import CloseConfirmDialog from './components/CloseConfirmDialog.vue'
import type { SshConnectionConfig, SshConnection } from '../../main/ssh/types'

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
const {
  addOrUpdate,
  markComplete,
  markError,
  hasActive,
  restoreQueue,
  markCancelled,
  lastActiveTab
} = useTransferStore()

// 对话框
const showDialog = defineModel<boolean>('showDialog', { default: false })
const editSession = ref<SshConnection | null>(null)
const showSettings = ref(false)
const showAbout = ref(false)
const showQueue = ref(false)
const disconnectCleanup = ref<(() => void) | null>(null)
const transferCleanups: (() => void)[] = []

const mainVerticalRef = ref<HTMLElement | null>(null)
const tabBarRef = ref<InstanceType<typeof TabBar> | null>(null)
let resizeObserver: ResizeObserver | null = null

// 面板固定状态（从设置读取）
const sessionsPinned = ref(settingsStore.sessionsPinned.value)
const queuePinned = ref(settingsStore.queuePinned.value)

watch(sessionsPinned, (v) => {
  settingsStore.setSessionsPinned(v)
  settingsStore.flush()
})
watch(queuePinned, (v) => {
  settingsStore.setQueuePinned(v)
  settingsStore.flush()
})

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
const { minimizeWindow, maximizeWindow, closeWindow, confirmClose, cancelClose, pendingClose } =
  useWindowControls(persistTabs, hasActive, () => window.api.cancelAllTransfers())

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
  tabBarRef.value?.updateTabColors()
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
    window.api.onTransferComplete((data) =>
      markComplete(data.id, data.localPath, data.transferred, data.total)
    ),
    window.api.onTransferError((data) => markError(data.id, data.error)),
    window.api.onTransferCancelled((data) => markCancelled(data.id))
  )
  window.addEventListener('resize', onResize)
  resizeObserver = new ResizeObserver(() => {
    const id = activeTabId.value
    if (id) {
      sessionRefs.value[id]?.focusAndFit()
    }
  })
  if (mainVerticalRef.value) {
    resizeObserver.observe(mainVerticalRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  resizeCleanup()
  disconnectCleanup.value?.()
  transferCleanups.forEach((fn) => fn())
  resizeObserver?.disconnect()
})

watch(
  () => settingsStore.theme.value,
  (val) => {
    if (val) {
      applyTheme(val)
      nextTick(() => tabBarRef.value?.updateTabColors())
    }
  }
)

watch(activeTabId, (id) => {
  if (!id) return
  nextTick(() => sessionRefs.value[id]?.focusAndFit())
})

// 重连锁，防止重复重连
const reconnecting = new Set<string>()

async function reconnectTab(tabId: string): Promise<void> {
  if (reconnecting.has(tabId)) return
  const tab = tabs.value.find((t) => t.id === tabId)
  if (!tab || (tab.connected && tab.ftpConnected)) return
  reconnecting.add(tabId)
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
  reconnecting.delete(tabId)
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
    <!-- 标签栏 -->
    <TabBar
      ref="tabBarRef"
      :tabs="tabs"
      :active-tab-id="activeTabId"
      :frameless="!useSystemTitleBar"
      :drag-index="dragIndex"
      :drag-over-index="dragOverIndex"
      @select="setActiveTab"
      @close="handleCloseTab"
      @reconnect="reconnectTab"
      @contextmenu="(e, id) => openContextMenu(e, id)"
      @wheel="onTabWheel"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="(i) => doDrop(i, moveTab, persistTabs)"
      @dragend="onDragEnd"
      @mouse-up="
        (id, e) => {
          if (e.button === 1) handleCloseTab(id)
        }
      "
      @minimize="minimizeWindow"
      @maximize="maximizeWindow"
      @close-window="closeWindow"
    />
    <!-- 右键菜单 -->
    <TabContextMenu
      v-if="contextMenu"
      ref="menuEl"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @reconnect="(reconnectTab(contextMenu!.tabId), closeContextMenu())"
      @close-left="(closeTabsToLeft(contextMenu!.tabId), closeContextMenu())"
      @close-right="(closeTabsToRight(contextMenu!.tabId), closeContextMenu())"
      @close-all="(closeAllTabs(), closeContextMenu())"
      @close="closeContextMenu()"
    />
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
        <!-- 会话面板（始终 absolute 定位） -->
        <SessionsPanel
          v-if="showSessions"
          :docked="sessionsPinned"
          :sessions="savedConnections"
          @update:pinned="(v) => (sessionsPinned = v)"
          @select="handleSessionSelect"
          @edit="handleSessionEdit"
          @delete="handleSessionDelete"
          @close="closeSessions"
          @export="handleExport"
          @import="handleImport"
          @reorder="moveSavedConnection"
        />
        <!-- 主内容区域（padding 由固定状态控制） -->
        <div
          ref="mainVerticalRef"
          class="main-vertical"
          :style="{
            paddingLeft: showSessions && sessionsPinned ? '240px' : '0',
            paddingRight: showQueue && queuePinned ? '340px' : '0'
          }"
        >
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
                  tabs.find((t) => t.id === activeTabId)?.ftpConnected
                    ? 'connected'
                    : 'disconnected'
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
          <!-- 本地输入栏 -->
          <LocalInputBar
            v-if="activeTab"
            :tab-id="activeTab.id"
            :connected="activeTab.connected"
            :sub-tab="activeTab.subTab"
          />
        </div>
        <!-- 传输队列（始终 absolute 定位） -->
        <TransferQueue
          v-if="showQueue"
          :docked="queuePinned"
          @update:pinned="(v) => (queuePinned = v)"
          @close="showQueue = false"
        />
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
  min-height: 0;
  position: relative;
}

.main-vertical {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  position: relative;
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
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
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
