import { reactive, toRefs } from 'vue'
import type { SshConnection, SshConnectionConfig } from '../../../main/ssh/types'
import { v4 as uuidv4 } from 'uuid'

export interface Tab {
  id: string
  name: string
  config: SshConnectionConfig
  connected: boolean
  ftpConnected: boolean
  loading: boolean
  error: string | null
  subTab: 'ssh' | 'ftp'
}

const state = reactive({
  tabs: [] as Tab[],
  activeTabId: null as string | null,
  savedConnections: [] as SshConnection[],
  showSessions: false
})

export function useConnectionStore() {
  function addTab(config: SshConnectionConfig, name: string): Tab {
    const id = uuidv4()
    const tab: Tab = {
      id,
      name,
      config: { ...config },
      connected: false,
      ftpConnected: false,
      loading: true,
      error: null,
      subTab: 'ssh'
    }
    state.tabs.push(tab)
    state.activeTabId = id
    return tab
  }

  function removeTab(id: string): void {
    window.api.disconnect(id)
    const idx = state.tabs.findIndex((t) => t.id === id)
    if (idx === -1) return
    state.tabs.splice(idx, 1)
    if (state.activeTabId === id) {
      state.activeTabId = state.tabs.length > 0 ? state.tabs[state.tabs.length - 1].id : null
    }
  }

  function setActiveTab(id: string): void {
    state.activeTabId = id
  }

  function setSubTab(id: string, subTab: 'ssh' | 'ftp'): void {
    const tab = state.tabs.find((t) => t.id === id)
    if (tab) tab.subTab = subTab
  }

  function moveTab(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return
    const [tab] = state.tabs.splice(fromIndex, 1)
    state.tabs.splice(toIndex, 0, tab)
  }

  function toggleSessions(): void {
    state.showSessions = !state.showSessions
  }

  function closeSessions(): void {
    state.showSessions = false
  }

  async function loadSavedConnections(): Promise<void> {
    const data: SshConnection[] = await window.api.getConnections()
    if (!data || data.length === 0) return
    state.savedConnections.length = 0
    for (const item of data) {
      state.savedConnections.push(item)
    }
  }

  async function saveConnectionByConfig(
    config: SshConnectionConfig,
    name: string
  ): Promise<SshConnection> {
    const conn: SshConnection = {
      id: uuidv4(),
      name,
      config: { ...config },
      createdAt: Date.now()
    }
    state.savedConnections.push(conn)
    await saveToDisk()
    return conn
  }

  async function updateConnection(
    id: string,
    config: SshConnectionConfig,
    name: string
  ): Promise<void> {
    const existing = state.savedConnections.find((c) => c.id === id)
    if (!existing) return
    existing.name = name
    existing.config = { ...config }
    await saveToDisk()
  }

  async function moveSavedConnection(fromIndex: number, toIndex: number): Promise<void> {
    if (fromIndex === toIndex) return
    const [conn] = state.savedConnections.splice(fromIndex, 1)
    state.savedConnections.splice(toIndex, 0, conn)
    await saveToDisk()
  }

  async function deleteConnection(id: string): Promise<void> {
    const idx = state.savedConnections.findIndex((c) => c.id === id)
    if (idx !== -1) {
      state.savedConnections.splice(idx, 1)
      await saveToDisk()
    }
  }

  async function saveToDisk(): Promise<void> {
    const plain = state.savedConnections.map((c) => JSON.parse(JSON.stringify(c)))
    await window.api.saveConnections(plain)
  }

  return {
    ...toRefs(state),
    addTab,
    removeTab,
    setActiveTab,
    toggleSessions,
    closeSessions,
    loadSavedConnections,
    saveConnectionByConfig,
    moveTab,
    moveSavedConnection,
    setSubTab,
    updateConnection,
    deleteConnection,
    saveToDisk
  }
}
