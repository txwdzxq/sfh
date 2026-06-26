// 存储 IPC 处理器 — 持久化连接、设置、标签状态到 JSON 文件

import { ipcMain, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { IPC } from '../../shared/ipcChannels'
import type { AppSettings, SettingsData } from '../../shared/types'
import { SshConnection } from '../ssh/types'

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
  const filePath = getStorePath()
  if (!existsSync(filePath)) return []
  // 先尝试以明文读取（兼容旧版本未加密的 connections.json）
  try {
    const text = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(text)
    return data
  } catch {
    // 明文读取失败，尝试用 safeStorage 解密
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const encrypted = readFileSync(filePath)
        const decrypted = safeStorage.decryptString(encrypted)
        return JSON.parse(decrypted)
      } catch {
        // 解密也失败，返回空数组
      }
    }
    return []
  }
}

/** 将连接列表写入磁盘（加密存储） */
function saveConnections(connections: SshConnection[]): void {
  const json = JSON.stringify(connections, null, 2)
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json)
    writeFileSync(getStorePath(), encrypted)
  } else {
    console.warn('[store] safeStorage not available, saving credentials in plain text')
    writeFileSync(getStorePath(), json, 'utf-8')
  }
}

export function loadSettings(): SettingsData {
  try {
    const data = readFileSync(getSettingsPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return {
      settings: {
        reopenTabs: false,
        autoFtp: false,
        useSystemTitleBar: true,
        fontSize: 14,
        zoom: 1,
        locale: 'zh-CN',
        theme: 'mocha',
        windowWidth: 900,
        windowHeight: 670,
        windowX: null,
        windowY: null,
        windowMaximized: false,
        defaultDownloadPath: '',
        askDownloadLocation: true,
        showQueueOnDownload: false,
        sessionsPinned: false,
        queuePinned: false,
        sessionPanelWidth: 240,
        queuePanelWidth: 340,
        downloadMode: 'chunk' as const,
        opacity: 100
      },
      tabs: []
    }
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
    return {
      reopenTabs: false,
      autoFtp: false,
      useSystemTitleBar: true,
      fontSize: 14,
      zoom: 1,
      locale: 'zh-CN',
      theme: 'mocha',
      windowWidth: 900,
      windowHeight: 670,
      windowX: null,
      windowY: null,
      windowMaximized: false,
      defaultDownloadPath: '',
      askDownloadLocation: true,
      showQueueOnDownload: false,
      sessionsPinned: false,
      queuePinned: false,
      sessionPanelWidth: 240,
      queuePanelWidth: 340,
      downloadMode: 'chunk' as const,
      opacity: 100
    }
  }
}

export function registerStoreIpc(): void {
  ipcMain.handle(IPC.STORE_GET_CONNECTIONS, async (): Promise<SshConnection[]> => {
    return loadConnections()
  })

  ipcMain.handle(
    IPC.STORE_SAVE_CONNECTIONS,
    async (_event, connections: SshConnection[]): Promise<void> => {
      saveConnections(connections)
    }
  )

  ipcMain.handle(IPC.STORE_GET_SETTINGS, async (): Promise<SettingsData> => {
    return loadSettings()
  })

  ipcMain.handle(IPC.STORE_SAVE_SETTINGS, async (_event, data: SettingsData): Promise<void> => {
    saveSettings(data)
  })
}
