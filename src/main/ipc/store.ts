// 存储 IPC 处理器 — 持久化连接、设置、标签状态到 JSON 文件

import { ipcMain } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { SshConnection } from '../ssh/types'
import { SshConnectionConfig } from '../ssh/types'

export interface AppSettings {
  reopenTabs: boolean
  autoFtp: boolean
  useSystemTitleBar: boolean
  fontSize: number
  zoom: number
  locale: string
  windowWidth: number
  windowHeight: number
}

interface SavedTab {
  name: string
  config: SshConnectionConfig
  forkFrom?: string
}

interface SettingsData {
  settings: AppSettings
  tabs: SavedTab[]
}

/** 获取持久化文件路径：{userData}/config/connections.json */
function getStorePath(): string {
  const userDataPath = app.getPath('userData')
  const storeDir = join(userDataPath, 'config')
  if (!existsSync(storeDir)) {
    mkdirSync(storeDir, { recursive: true })
  }
  return join(storeDir, 'connections.json')
}

/** 获取设置文件路径 */
function getSettingsPath(): string {
  const userDataPath = app.getPath('userData')
  const storeDir = join(userDataPath, 'config')
  if (!existsSync(storeDir)) {
    mkdirSync(storeDir, { recursive: true })
  }
  return join(storeDir, 'settings.json')
}

/** 从磁盘加载已保存的连接列表 */
function loadConnections(): SshConnection[] {
  try {
    const data = readFileSync(getStorePath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

/** 将连接列表写入磁盘 */
function saveConnections(connections: SshConnection[]): void {
  writeFileSync(getStorePath(), JSON.stringify(connections, null, 2))
}

export function loadSettings(): SettingsData {
  try {
    const data = readFileSync(getSettingsPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return { settings: { reopenTabs: false, autoFtp: false, useSystemTitleBar: true, fontSize: 14, zoom: 1, locale: 'zh-CN', windowWidth: 900, windowHeight: 670 }, tabs: [] }
  }
}

export function saveSettings(data: SettingsData): void {
  writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2))
}

/** 供主进程直接读取设置（创建窗口前使用） */
export function loadSettingsData(): AppSettings {
  try {
    const data = readFileSync(getSettingsPath(), 'utf-8')
    return JSON.parse(data).settings
  } catch {
    return { reopenTabs: false, autoFtp: false, useSystemTitleBar: true, fontSize: 14, zoom: 1, locale: 'zh-CN', windowWidth: 900, windowHeight: 670 }
  }
}

export function registerStoreIpc(): void {
  ipcMain.handle('store:getConnections', async (): Promise<SshConnection[]> => {
    return loadConnections()
  })

  ipcMain.handle(
    'store:saveConnections',
    async (_event, connections: SshConnection[]): Promise<void> => {
      saveConnections(connections)
    }
  )

  ipcMain.handle('store:getSettings', async (): Promise<SettingsData> => {
    return loadSettings()
  })

  ipcMain.handle(
    'store:saveSettings',
    async (_event, data: SettingsData): Promise<void> => {
      saveSettings(data)
    }
  )
}
