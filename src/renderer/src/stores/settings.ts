import { reactive, toRefs } from 'vue'
import type {
  AppSettings,
  SavedTab,
  Theme,
  TransferItemData,
  FtpBookmark
} from '../../../shared/types'
export type { Theme }

const defaults: AppSettings = {
  reopenTabs: false,
  autoFtp: false,
  useSystemTitleBar: true,
  locale: 'zh-CN',
  fontSize: 14,
  zoom: 1,
  theme: 'mocha',
  windowWidth: 900,
  windowHeight: 670,
  defaultDownloadPath: '',
  askDownloadLocation: true,
  showQueueOnDownload: false,
  sessionsPinned: false,
  queuePinned: false
}

const state = reactive({
  ...defaults,
  savedTabs: [] as SavedTab[],
  savedTransfers: [] as TransferItemData[],
  savedFtpBookmarks: [] as FtpBookmark[],
  loaded: false
})

export function useSettingsStore() {
  async function load(): Promise<void> {
    try {
      const data = await window.api.getSettings()
      if (data.settings) {
        Object.assign(state, defaults, data.settings)
      }
      state.savedTabs = data.tabs || []
      state.savedTransfers = data.transfers || []
      state.savedFtpBookmarks = data.ftpBookmarks || []
    } catch {
      Object.assign(state, defaults)
      state.savedTabs = []
      state.savedTransfers = []
      state.savedFtpBookmarks = []
    }
    state.loaded = true
  }

  async function save(): Promise<void> {
    const data = JSON.parse(
      JSON.stringify({
        settings: extractSettings(),
        tabs: state.savedTabs,
        transfers: state.savedTransfers,
        ftpBookmarks: state.savedFtpBookmarks
      })
    )
    await window.api.saveSettings(data)
  }

  function extractSettings(): AppSettings {
    return {
      reopenTabs: state.reopenTabs,
      autoFtp: state.autoFtp,
      useSystemTitleBar: state.useSystemTitleBar,
      locale: state.locale,
      fontSize: state.fontSize,
      zoom: state.zoom,
      theme: state.theme,
      windowWidth: state.windowWidth,
      windowHeight: state.windowHeight,
      defaultDownloadPath: state.defaultDownloadPath,
      askDownloadLocation: state.askDownloadLocation,
      showQueueOnDownload: state.showQueueOnDownload,
      sessionsPinned: state.sessionsPinned,
      queuePinned: state.queuePinned
    }
  }

  function setReopenTabs(val: boolean): void {
    state.reopenTabs = val
  }

  function setAutoFtp(val: boolean): void {
    state.autoFtp = val
  }

  function setUseSystemTitleBar(val: boolean): void {
    state.useSystemTitleBar = val
  }

  function setLocale(val: string): void {
    state.locale = val
  }

  function setFontSize(val: number): void {
    state.fontSize = val
  }

  function setZoom(val: number): void {
    state.zoom = val
  }

  function setTheme(val: Theme): void {
    state.theme = val
  }

  function setDefaultDownloadPath(val: string): void {
    state.defaultDownloadPath = val
  }

  function setAskDownloadLocation(val: boolean): void {
    state.askDownloadLocation = val
  }

  function setShowQueueOnDownload(val: boolean): void {
    state.showQueueOnDownload = val
  }

  function setSessionsPinned(val: boolean): void {
    state.sessionsPinned = val
  }

  function setQueuePinned(val: boolean): void {
    state.queuePinned = val
  }

  async function flush(): Promise<void> {
    await save()
  }

  return {
    ...toRefs(state),
    load,
    save,
    setReopenTabs,
    setAutoFtp,
    setUseSystemTitleBar,
    setLocale,
    setFontSize,
    setZoom,
    setTheme,
    setDefaultDownloadPath,
    setAskDownloadLocation,
    setShowQueueOnDownload,
    setSessionsPinned,
    setQueuePinned,
    flush
  }
}
