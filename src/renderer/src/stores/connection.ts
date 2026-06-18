// 全局状态管理 — 管理标签页、已保存连接、会话面板状态
// 使用 reactive + toRefs 模式保持响应式解构

import { reactive, toRefs, toRaw } from 'vue'
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
  forkFrom?: string
  subTab: 'ssh' | 'ftp'
}

interface SavedConnectionData {
  id: string
  name: string
  config: SshConnectionConfig
  group?: string
  createdAt: number
}

const state = reactive({
  tabs: [] as Tab[],
  activeTabId: null as string | null,
  savedConnections: [] as SshConnection[],
  showSessions: false
})

export function useConnectionStore() {
  /** 添加新标签页 */
  function addTab(config: SshConnectionConfig, name: string, forkFrom?: string): Tab {
    const id = uuidv4()
    const tab: Tab = {
      id,
      name,
      config: { ...config },
      connected: false,
      ftpConnected: false,
      loading: false,
      error: null,
      forkFrom,
      subTab: 'ssh'
    }
    state.tabs.push(tab)
    state.activeTabId = id
    return tab
  }

  /** 移除标签页并断开 SSH */
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

  /** 切换子标签页 */
  function setSubTab(id: string, subTab: 'ssh' | 'ftp'): void {
    const tab = state.tabs.find((t) => t.id === id)
    if (tab) tab.subTab = subTab
  }

  /** 移动标签页位置 */
  function moveTab(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return
    const [tab] = state.tabs.splice(fromIndex, 1)
    state.tabs.splice(toIndex, 0, tab)
  }

  function getActiveTab(): Tab | undefined {
    return state.tabs.find((t) => t.id === state.activeTabId)
  }

  function toggleSessions(): void {
    state.showSessions = !state.showSessions
  }

  function closeSessions(): void {
    state.showSessions = false
  }

  /** 从磁盘加载已保存的连接列表 */
  async function loadSavedConnections(): Promise<void> {
    const data: SshConnection[] = await window.api.getConnections()
    if (!data || data.length === 0) return
    state.savedConnections.length = 0
    for (const item of data) {
      state.savedConnections.push(item)
    }
  }

  /** 保存连接（自动去重：同 host+port+username 则更新） */
  async function saveConnectionByConfig(
    config: SshConnectionConfig,
    name: string
  ): Promise<SshConnection> {
    const existing = state.savedConnections.find(
      (c) =>
        c.config.host === config.host &&
        c.config.port === config.port &&
        c.config.username === config.username
    )
    if (existing) {
      existing.name = name
      existing.config = { ...config }
      await saveToDisk()
      return existing
    }
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

  /** 更新指定 ID 的连接 */
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

  /** 删除连接 */
  async function deleteConnection(id: string): Promise<void> {
    const idx = state.savedConnections.findIndex((c) => c.id === id)
    if (idx !== -1) {
      state.savedConnections.splice(idx, 1)
      await saveToDisk()
    }
  }

  /** 持久化到磁盘 */
  async function saveToDisk(): Promise<void> {
    const plain = state.savedConnections.map(c => toRaw(c))
    await window.api.saveConnections(plain)
  }

  return {
    ...toRefs(state),
    addTab,
    removeTab,
    setActiveTab,
    getActiveTab,
    toggleSessions,
    closeSessions,
    loadSavedConnections,
    saveConnectionByConfig,
    moveTab,
    setSubTab,
    updateConnection,
    deleteConnection,
    saveToDisk
  }
}
