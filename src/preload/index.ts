// 预加载脚本 — 通过 contextBridge 将 IPC API 安全暴露给渲染进程

import { contextBridge, ipcRenderer, webUtils, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '../shared/ipcChannels'
import type { SettingsData } from '../shared/types'
import type { SshConnectionConfig, SshConnection, SftpEntry } from '../main/ssh/types'

/** 带超时的 IPC invoke 包装，超时后抛出 Error */
function invokeWithTimeout<T>(channel: string, timeoutMs: number, ...args: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`IPC ${channel} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    ipcRenderer
      .invoke(channel, ...args)
      .then((result) => {
        clearTimeout(timer)
        resolve(result as T)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

// 所有与主进程通信的 API
const sshApi = {
  // SSH 连接（invoke/handle，等待结果）
  connect: (
    id: string,
    config: SshConnectionConfig,
    cols?: number,
    rows?: number
  ): Promise<void> => {
    if (process.env.NODE_ENV !== 'production') console.log(`[preload] connect id=${id}`)
    return invokeWithTimeout<void>(IPC.SSH_CONNECT, 30000, id, config, cols, rows)
  },
  // 写入数据到 shell（send/on，单向）
  write: (id: string, data: string): void => ipcRenderer.send(IPC.SSH_WRITE, id, data),
  resize: (id: string, cols: number, rows: number): void =>
    ipcRenderer.send(IPC.SSH_RESIZE, id, cols, rows),
  disconnect: (id: string): void => {
    console.log(`[preload] disconnect id=${id}`)
    ipcRenderer.send(IPC.SSH_DISCONNECT, id)
  },
  // SFTP
  readdir: (id: string, path: string): Promise<SftpEntry[]> =>
    invokeWithTimeout(IPC.SFTP_READDIR, 15000, id, path),
  realpath: (id: string, path: string): Promise<string> =>
    invokeWithTimeout(IPC.SFTP_REALPATH, 15000, id, path),
  connectSftp: (id: string): Promise<void> => invokeWithTimeout<void>(IPC.SFTP_CONNECT, 15000, id),
  download: (id: string, remotePath: string): Promise<void> =>
    invokeWithTimeout(IPC.SFTP_DOWNLOAD, 60000, id, remotePath),
  downloadDirect: (id: string, remotePath: string): Promise<void> =>
    invokeWithTimeout(IPC.SFTP_DOWNLOAD_DIRECT, 60000, id, remotePath),
  retryDownload: (id: string, remotePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SFTP_DOWNLOAD, id, remotePath),
  upload: (id: string, remotePath: string): Promise<void> =>
    invokeWithTimeout(IPC.SFTP_UPLOAD, 60000, id, remotePath),
  uploadFile: (id: string, localPath: string, remotePath: string): Promise<void> =>
    invokeWithTimeout(IPC.SFTP_UPLOAD_FILE, 60000, id, localPath, remotePath),
  dragDownload: (id: string, remotePath: string): void =>
    ipcRenderer.send(IPC.SFTP_DRAG_DOWNLOAD, id, remotePath),
  // 监听来自主进程的数据事件（返回清理函数）
  onData: (callback: (event: { id: string; data: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }): void =>
      callback(data)
    ipcRenderer.on(IPC.SSH_DATA, handler)
    return () => ipcRenderer.removeListener(IPC.SSH_DATA, handler)
  },
  onError: (callback: (event: { id: string; message: string }) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { id: string; message: string }
    ): void => callback(data)
    ipcRenderer.on(IPC.SSH_ERROR, handler)
    return () => ipcRenderer.removeListener(IPC.SSH_ERROR, handler)
  },
  onDisconnect: (callback: (event: { id: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string }): void =>
      callback(data)
    ipcRenderer.on(IPC.SSH_DISCONNECT, handler)
    return () => ipcRenderer.removeListener(IPC.SSH_DISCONNECT, handler)
  },
  // 持久化存储 API
  getConnections: (): Promise<SshConnection[]> => ipcRenderer.invoke(IPC.STORE_GET_CONNECTIONS),
  saveConnections: (connections: SshConnection[]): Promise<void> =>
    ipcRenderer.invoke(IPC.STORE_SAVE_CONNECTIONS, connections),
  getSettings: (): Promise<SettingsData> => ipcRenderer.invoke(IPC.STORE_GET_SETTINGS),
  saveSettings: (data: SettingsData): Promise<void> =>
    ipcRenderer.invoke(IPC.STORE_SAVE_SETTINGS, data),
  setZoomFactor: (factor: number): void => webFrame.setZoomFactor(factor),
  // 文件选择器
  openPrivateKey: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_PRIVATE_KEY),
  openFolderDialog: (): Promise<string | null> => ipcRenderer.invoke(IPC.DIALOG_OPEN_FOLDER),
  exportConnections: (data: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.DIALOG_EXPORT_CONNECTIONS, data),
  importConnections: (): Promise<unknown> => ipcRenderer.invoke(IPC.DIALOG_IMPORT_CONNECTIONS),
  // 获取应用版本
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),
  // 获取框架版本
  getVersions: (): Promise<{ electron: string; chrome: string; node: string }> =>
    ipcRenderer.invoke(IPC.APP_GET_VERSIONS),
  getDefaultDownloadsPath: (): Promise<string> =>
    ipcRenderer.invoke(IPC.APP_GET_DEFAULT_DOWNLOADS_PATH),
  // 获取拖拽文件的本地路径
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },
  // 传输队列事件监听（返回清理函数）
  onTransferProgress: (
    callback: (data: {
      id: string
      filename: string
      type: 'upload' | 'download'
      transferred: number
      total: number
      speed: number
      tabId?: string
      remotePath?: string
      localPath?: string
      connectionKey?: string
    }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: {
        id: string
        filename: string
        type: 'upload' | 'download'
        transferred: number
        total: number
        speed: number
        tabId?: string
        remotePath?: string
        localPath?: string
        connectionKey?: string
      }
    ): void => callback(data)
    ipcRenderer.on(IPC.TRANSFER_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC.TRANSFER_PROGRESS, handler)
  },
  onTransferComplete: (
    callback: (data: {
      id: string
      localPath?: string
      transferred?: number
      total?: number
    }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: {
        id: string
        localPath?: string
        transferred?: number
        total?: number
      }
    ): void => callback(data)
    ipcRenderer.on(IPC.TRANSFER_COMPLETE, handler)
    return () => ipcRenderer.removeListener(IPC.TRANSFER_COMPLETE, handler)
  },
  onTransferError: (callback: (data: { id: string; error: string }) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { id: string; error: string }
    ): void => callback(data)
    ipcRenderer.on(IPC.TRANSFER_ERROR, handler)
    return () => ipcRenderer.removeListener(IPC.TRANSFER_ERROR, handler)
  },
  onTransferDragReady: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on(IPC.TRANSFER_DRAG_READY, handler)
    return () => ipcRenderer.removeListener(IPC.TRANSFER_DRAG_READY, handler)
  },
  onTransferCancelled: (callback: (data: { id: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string }): void =>
      callback(data)
    ipcRenderer.on(IPC.TRANSFER_CANCELLED, handler)
    return () => ipcRenderer.removeListener(IPC.TRANSFER_CANCELLED, handler)
  },
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners(IPC.SSH_DATA)
    ipcRenderer.removeAllListeners(IPC.SSH_ERROR)
    ipcRenderer.removeAllListeners(IPC.SSH_DISCONNECT)
    ipcRenderer.removeAllListeners(IPC.TRANSFER_PROGRESS)
    ipcRenderer.removeAllListeners(IPC.TRANSFER_COMPLETE)
    ipcRenderer.removeAllListeners(IPC.TRANSFER_ERROR)
    ipcRenderer.removeAllListeners(IPC.TRANSFER_DRAG_READY)
    ipcRenderer.removeAllListeners(IPC.TRANSFER_CANCELLED)
  },
  // 窗口控制
  minimize: (): Promise<void> => ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
  maximize: (): Promise<void> => ipcRenderer.invoke(IPC.WINDOW_MAXIMIZE),
  unmaximize: (): Promise<void> => ipcRenderer.invoke(IPC.WINDOW_UNMAXIMIZE),
  close: (): Promise<void> => ipcRenderer.invoke(IPC.WINDOW_CLOSE),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.WINDOW_IS_MAXIMIZED),
  getPosition: (): Promise<[number, number]> => ipcRenderer.invoke(IPC.WINDOW_GET_POSITION),
  setPosition: (x: number, y: number): Promise<void> =>
    ipcRenderer.invoke(IPC.WINDOW_SET_POSITION, x, y),
  setWindowOpacity: (factor: number): Promise<void> =>
    ipcRenderer.invoke(IPC.WINDOW_SET_OPACITY, factor),
  showItemInFolder: (localPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SHELL_SHOW_ITEM, localPath),
  pauseTransfer: (tid: string): void => ipcRenderer.send(IPC.TRANSFER_PAUSE, tid),
  resumeTransfer: (
    tid: string,
    tabId?: string,
    remotePath?: string,
    localPath?: string,
    offset?: number,
    connectionKey?: string
  ): void =>
    ipcRenderer.send(IPC.TRANSFER_RESUME, tid, tabId, remotePath, localPath, offset, connectionKey),
  cancelTransfer: (tid: string): void => ipcRenderer.send(IPC.TRANSFER_CANCEL, tid),
  cancelAllTransfers: (): void => ipcRenderer.send(IPC.TRANSFER_CANCEL_ALL)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', sshApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // 未启用 contextIsolation 时的降级方案
  // @ts-ignore - contextIsolation disabled fallback
  window.electron = electronAPI
  // @ts-ignore - contextIsolation disabled fallback
  window.api = sshApi
}
