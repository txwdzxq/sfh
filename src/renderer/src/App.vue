<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { useConnectionStore } from './stores/connection'
import { useSettingsStore } from './stores/settings'
import { useTransferStore } from './stores/transfer'
import './assets/themes.css'
import './assets/app-layout.css'
import { useTabManager } from './composables/useTabManager'
import { useAppInit } from './composables/useAppInit'
import { useAppUI } from './composables/useAppUI'
import { useFtpCache } from './composables/useFtpCache'
import { useTabDrag } from './composables/useTabDrag'
import { useTabContextMenu } from './composables/useTabContextMenu'
import { useZoomPreview } from './composables/useZoomPreview'
import { useResizeOverlay } from './composables/useResizeOverlay'
import { useWindowControls } from './composables/useWindowControls'
import { useTabPersistence } from './composables/useTabPersistence'
import { useFlyParticle } from './composables/useFlyParticle'
import { useAppIpcListeners } from './composables/useAppIpcListeners'
import { useReconnect } from './composables/useReconnect'
import { useTabActions } from './composables/useTabActions'
import { useSessionActions } from './composables/useSessionActions'
import { useSessionCallbacks } from './composables/useSessionCallbacks'
import Sidebar from './components/Sidebar.vue'
import SessionsPanel from './components/SessionsPanel.vue'
import TransferQueue from './components/TransferQueue.vue'
import LocalInputBar from './components/LocalInputBar.vue'
import TabBar from './components/TabBar.vue'
import TabContextMenu from './components/TabContextMenu.vue'
import DialogsSection from './components/DialogsSection.vue'
import InitScreen from './components/InitScreen.vue'
import WelcomeScreen from './components/WelcomeScreen.vue'
import SessionRenderer from './components/SessionRenderer.vue'
import SubTabBar from './components/SubTabBar.vue'
import ConnectionStatusBar from './components/ConnectionStatusBar.vue'
import type { SshConnection } from '../../main/ssh/types'
import type { FtpCacheEntry } from './composables/useFtpCache'

const connectionStore = useConnectionStore()
const {
  savedConnections,
  showSessions,
  setActiveTab,
  setSubTab,
  moveTab,
  toggleSessions,
  closeSessions,
  moveSavedConnection
} = connectionStore

const { sessionRefs, setSessionRef } = useTabManager()
const { tabs, activeTabId } = connectionStore
const settingsStore = useSettingsStore()
const { useSystemTitleBar } = settingsStore
const { addOrUpdate, markComplete, markError, hasActive, restoreQueue, markCancelled } =
  useTransferStore()

const {
  showSettings,
  showAbout,
  showQueue,
  sessionsPinned,
  queuePinned,
  onShowQueue,
  onSettings,
  onAbout,
  toggleQueue
} = useAppUI()

// 面板宽度
const sessionPanelWidth = settingsStore.sessionPanelWidth
const queuePanelWidth = settingsStore.queuePanelWidth
watch(sessionPanelWidth, () => settingsStore.flush())
watch(queuePanelWidth, () => settingsStore.flush())

// 对话框
const showDialog = ref(false)
const editSession = ref<SshConnection | null>(null)
const mainVerticalRef = ref<HTMLElement | null>(null)
const tabBarRef = ref<InstanceType<typeof TabBar> | null>(null)
const tabMenuRef = ref<InstanceType<typeof TabContextMenu> | null>(null)

// Composables
const { ftpCache, handleFtpPreload, removeCache } = useFtpCache()
const { contextMenu, openContextMenu, closeContextMenu } = useTabContextMenu(tabMenuRef)
const { dragIndex, dragOverIndex, onDragStart, onDragOver, onDragLeave, doDrop, onDragEnd } =
  useTabDrag()
const { appTransform, onZoomDrag, onZoomApply } = useZoomPreview(() => settingsStore.zoom.value)
const { windowSize, showSize, onResize, cleanup: resizeCleanup } = useResizeOverlay()
const { persistTabs } = useTabPersistence()
const { flyParticles, startFly } = useFlyParticle()
const { minimizeWindow, maximizeWindow, closeWindow, confirmClose, cancelClose, pendingClose } =
  useWindowControls(persistTabs, hasActive, () => window.api.cancelAllTransfers())

const { phase, initError, init: initApp, applyTheme } = useAppInit()
const { reconnectTab } = useReconnect(ftpCache)
const { handleCloseTab, closeTabsToLeft, closeTabsToRight, closeAllTabs, onTabWheel } =
  useTabActions(removeCache)
const {
  openDialog,
  handleSessionEdit,
  handleConnect,
  handleUpdate,
  closeDialog,
  handleSessionSelect,
  handleSessionDelete,
  handleExport,
  handleImport
} = useSessionActions({ showDialog, editSession })
const { onConnected, onError } = useSessionCallbacks({
  handleFtpPreload,
  sessionRefs
})
useAppIpcListeners({
  mainVerticalRef,
  onResize,
  resizeCleanup,
  sessionRefs,
  activeTabId,
  addOrUpdate,
  markComplete,
  markError,
  markCancelled,
  onDisconnected: (id) => {
    const tab = connectionStore.tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.connected = false
      tab.ftpConnected = false
    }
  }
})

const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) || null)

function onMiddleClick(id: string, e: MouseEvent): void {
  if (e.button === 1) handleCloseTab(id)
}

function onSessionLoaded(id: string, data: FtpCacheEntry): void {
  ftpCache[id] = data
}

function closeQueue(): void {
  showQueue.value = false
}

function onCloseSettings(): void {
  showSettings.value = false
}

function onCloseAbout(): void {
  showAbout.value = false
}

onMounted(async () => {
  await initApp()
  tabBarRef.value?.updateTabColors()
  if (settingsStore.savedTransfers.value.length > 0) {
    restoreQueue(settingsStore.savedTransfers.value)
  }
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

watch([sessionsPinned, queuePinned, sessionPanelWidth, queuePanelWidth], () => {
  nextTick(() => {
    const id = activeTabId.value
    if (id) sessionRefs.value[id]?.focusAndFit()
  })
})
</script>

<template>
  <InitScreen :phase :init-error="initError" @retry="initApp" />
  <div v-if="phase !== 'loading' && phase !== 'error'" class="app" :style="appTransform">
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
      @mouse-up="onMiddleClick"
      @minimize="minimizeWindow"
      @maximize="maximizeWindow"
      @close-window="closeWindow"
    />
    <!-- 右键菜单 -->
    <TabContextMenu
      v-if="contextMenu"
      ref="tabMenuRef"
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
          :width="sessionPanelWidth"
          @update:width="(v) => (sessionPanelWidth = v)"
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
            paddingLeft: showSessions && sessionsPinned ? sessionPanelWidth + 'px' : '0',
            paddingRight: showQueue && queuePinned ? queuePanelWidth + 'px' : '0'
          }"
        >
          <!-- 子标签栏 -->
          <SubTabBar :active-tab-id :tabs @select="setSubTab" />
          <ConnectionStatusBar
            v-if="activeTab"
            :tab="activeTab"
            @reconnect="reconnectTab(activeTab.id)"
          />
          <div class="content">
            <WelcomeScreen v-if="tabs.length === 0" @create="openDialog" />
            <SessionRenderer
              v-else
              :tabs
              :active-tab-id
              :ftp-cache="ftpCache"
              :set-session-ref="setSessionRef"
              @connected="onConnected"
              @error="onError"
              @loaded="onSessionLoaded"
              @download-start="startFly"
              @show-queue="onShowQueue"
            />
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
          :width="queuePanelWidth"
          @update:width="(v) => (queuePanelWidth = v)"
          @update:pinned="(v) => (queuePinned = v)"
          @close="closeQueue"
        />
      </div>
    </div>
    <DialogsSection
      :show-dialog="showDialog"
      :edit-session="editSession"
      :show-settings="showSettings"
      :show-about="showAbout"
      :pending-close="pendingClose"
      :show-size="showSize"
      :window-size="windowSize"
      :fly-particles="flyParticles"
      @connect="handleConnect"
      @update="handleUpdate"
      @close-dialog="closeDialog"
      @close-settings="onCloseSettings"
      @close-about="onCloseAbout"
      @zoom-drag="onZoomDrag"
      @zoom-apply="onZoomApply"
      @confirm-close="confirmClose"
      @cancel-close="cancelClose"
    />
  </div>
</template>
