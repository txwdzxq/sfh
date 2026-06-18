// 预加载脚本 — 通过 contextBridge 将 IPC API 安全暴露给渲染进程

import { contextBridge, ipcRenderer, webUtils, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { SshConnectionConfig } from '../main/ssh/types'

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
  connect: (id: string, config: SshConnectionConfig): Promise<void> => {
    if (process.env.NODE_ENV !== 'production') console.log(`[preload] connect id=${id}`)
    return invokeWithTimeout<void>('ssh:connect', 30000, id, config)
  },
  // 写入数据到 shell（send/on，单向）
  write: (id: string, data: string): void => ipcRenderer.send('ssh:write', id, data),
  resize: (id: string, cols: number, rows: number): void =>
    ipcRenderer.send('ssh:resize', id, cols, rows),
  disconnect: (id: string): void => {
    console.log(`[preload] disconnect id=${id}`)
    ipcRenderer.send('ssh:disconnect', id)
  },
  // SFTP
  readdir: (id: string, path: string): Promise<import('../main/ssh/types').SftpEntry[]> =>
    invokeWithTimeout('sftp:readdir', 15000, id, path),
  realpath: (id: string, path: string): Promise<string> =>
    invokeWithTimeout('sftp:realpath', 15000, id, path),
  connectSftp: (id: string): Promise<void> =>
    invokeWithTimeout<void>('sftp:connect', 15000, id),
  download: (id: string, remotePath: string): Promise<void> =>
    invokeWithTimeout('sftp:download', 60000, id, remotePath),
  downloadDirect: (id: string, remotePath: string): Promise<void> =>
    invokeWithTimeout('sftp:downloadDirect', 60000, id, remotePath),
  upload: (id: string, remotePath: string): Promise<void> =>
    invokeWithTimeout('sftp:upload', 60000, id, remotePath),
  uploadFile: (id: string, localPath: string, remotePath: string): Promise<void> =>
    invokeWithTimeout('sftp:uploadFile', 60000, id, localPath, remotePath),
  dragDownload: (id: string, remotePath: string): void =>
    ipcRenderer.send('sftp:dragDownload', id, remotePath),
  // 监听来自主进程的数据事件（返回清理函数）
  onData: (callback: (event: { id: string; data: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }): void =>
      callback(data)
    ipcRenderer.on('ssh:data', handler)
    return () => ipcRenderer.removeListener('ssh:data', handler)
  },
  onError: (callback: (event: { id: string; message: string }) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { id: string; message: string }
    ): void => callback(data)
    ipcRenderer.on('ssh:error', handler)
    return () => ipcRenderer.removeListener('ssh:error', handler)
  },
  onDisconnect: (callback: (event: { id: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string }): void =>
      callback(data)
    ipcRenderer.on('ssh:disconnect', handler)
    return () => ipcRenderer.removeListener('ssh:disconnect', handler)
  },
  // 持久化存储 API
  getConnections: (): Promise<import('../main/ssh/types').SshConnection[]> =>
    ipcRenderer.invoke('store:getConnections'),
  saveConnections: (connections: import('../main/ssh/types').SshConnection[]): Promise<void> =>
    ipcRenderer.invoke('store:saveConnections', connections),
  getSettings: (): Promise<{
    settings: { reopenTabs: boolean; autoFtp: boolean; useSystemTitleBar: boolean }
    tabs: { name: string; config: import('../main/ssh/types').SshConnectionConfig }[]
  }> => ipcRenderer.invoke('store:getSettings'),
  saveSettings: (data: {
    settings: { reopenTabs: boolean; autoFtp: boolean; useSystemTitleBar: boolean }
    tabs: { name: string; config: import('../main/ssh/types').SshConnectionConfig }[]
  }): Promise<void> => ipcRenderer.invoke('store:saveSettings', data),
  setZoomFactor: (factor: number): void => webFrame.setZoomFactor(factor),
  // 文件选择器
  openPrivateKey: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('dialog:openPrivateKey'),
  exportConnections: (data: string): Promise<boolean> =>
    ipcRenderer.invoke('dialog:exportConnections', data),
  importConnections: (): Promise<unknown> => ipcRenderer.invoke('dialog:importConnections'),
  // 获取应用版本
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  // 获取框架版本
  getVersions: (): Promise<{ electron: string; chrome: string; node: string }> =>
    ipcRenderer.invoke('app:getVersions'),
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
      }
    ): void => callback(data)
    ipcRenderer.on('transfer:progress', handler)
    return () => ipcRenderer.removeListener('transfer:progress', handler)
  },
  onTransferComplete: (callback: (data: { id: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string }): void =>
      callback(data)
    ipcRenderer.on('transfer:complete', handler)
    return () => ipcRenderer.removeListener('transfer:complete', handler)
  },
  onTransferError: (callback: (data: { id: string; error: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; error: string }): void =>
      callback(data)
    ipcRenderer.on('transfer:error', handler)
    return () => ipcRenderer.removeListener('transfer:error', handler)
  },
  onTransferDragReady: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('transfer:dragready', handler)
    return () => ipcRenderer.removeListener('transfer:dragready', handler)
  },
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners('ssh:data')
    ipcRenderer.removeAllListeners('ssh:error')
    ipcRenderer.removeAllListeners('ssh:disconnect')
    ipcRenderer.removeAllListeners('transfer:progress')
    ipcRenderer.removeAllListeners('transfer:complete')
    ipcRenderer.removeAllListeners('transfer:error')
    ipcRenderer.removeAllListeners('transfer:dragready')
  },
  // 窗口控制
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  unmaximize: (): Promise<void> => ipcRenderer.invoke('window:unmaximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  getPosition: (): Promise<[number, number]> => ipcRenderer.invoke('window:getPosition'),
  setPosition: (x: number, y: number): Promise<void> =>
    ipcRenderer.invoke('window:setPosition', x, y)
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
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = sshApi
}
