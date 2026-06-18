import { reactive } from 'vue'
import type { SshConnectionConfig } from '../../../main/ssh/types'

export interface AppSettings {
  reopenTabs: boolean
  autoFtp: boolean
  useSystemTitleBar: boolean
  locale: string
  fontSize: number
  zoom: number
  windowWidth: number
  windowHeight: number
}

interface SavedTab {
  name: string
  config: SshConnectionConfig
}

const state = reactive<{
  settings: AppSettings
  loaded: boolean
}>({
  settings: {
    reopenTabs: false,
    autoFtp: false,
    useSystemTitleBar: true,
    locale: 'zh-CN',
    fontSize: 14,
    zoom: 1,
    windowWidth: 900,
    windowHeight: 670
  },
  loaded: false
})

export let savedTabs: SavedTab[] = []

const defaults: AppSettings = {
  reopenTabs: false,
  autoFtp: false,
  useSystemTitleBar: true,
  locale: 'zh-CN',
  fontSize: 14,
  zoom: 1,
  windowWidth: 900,
  windowHeight: 670
}

export function useSettingsStore() {
  async function load(): Promise<void> {
    try {
      const data = await window.api.getSettings()
      state.settings = { ...defaults, ...data.settings }
      savedTabs = data.tabs
    } catch {
      state.settings = { ...defaults }
      savedTabs = []
    }
    state.loaded = true
  }

  async function save(): Promise<void> {
    const data = JSON.parse(JSON.stringify({ settings: state.settings, tabs: savedTabs }))
    await window.api.saveSettings(data)
  }

  function setReopenTabs(val: boolean): void {
    state.settings.reopenTabs = val
  }

  function setAutoFtp(val: boolean): void {
    state.settings.autoFtp = val
  }

  function setUseSystemTitleBar(val: boolean): void {
    state.settings.useSystemTitleBar = val
  }

  function setLocale(val: string): void {
    state.settings.locale = val
  }

  function setFontSize(val: number): void {
    state.settings.fontSize = val
  }

  function setZoom(val: number): void {
    state.settings.zoom = val
  }

  async function flush(): Promise<void> {
    await save()
  }

  return {
    state,
    savedTabs,
    load,
    save,
    setReopenTabs,
    setAutoFtp,
    setUseSystemTitleBar,
    setLocale,
    setFontSize,
    setZoom,
    flush
  }
}
