// 预加载脚本 — 通过 contextBridge 将 IPC API 安全暴露给渲染进程

import { contextBridge, ipcRenderer, webUtils, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { SshConnectionConfig } from '../main/ssh/types'

// 所有与主进程通信的 API
const sshApi = {
  // SSH 连接（invoke/handle，等待结果）
  connect: (id: string, config: SshConnectionConfig): Promise<void> => {
    console.log(`[preload] connect id=${id} ${config.username}@${config.host}:${config.port}`)
    return ipcRenderer.invoke('ssh:connect', id, config)
  },
  // 写入数据到 shell（send/on，单向）
  write: (id: string, data: string): void => ipcRenderer.send('ssh:write', id, data),
  resize: (id: string, cols: number, rows: number): void =>
    ipcRenderer.send('ssh:resize', id, cols, rows),
  disconnect: (id: string): void => {
    console.log(`[preload] disconnect id=${id}`)
    ipcRenderer.send('ssh:disconnect', id)
  },
  // 在已有 SSH 连接上创建子 shell（FTP）
  forkShell: (sourceId: string, newId: string): Promise<void> =>
    ipcRenderer.invoke('ssh:fork', sourceId, newId),
  // SFTP
  readdir: (id: string, path: string): Promise<import('../main/ssh/manager').SftpEntry[]> =>
    ipcRenderer.invoke('sftp:readdir', id, path),
  realpath: (id: string, path: string): Promise<string> =>
    ipcRenderer.invoke('sftp:realpath', id, path),
  connectSftp: (id: string): Promise<void> =>
    ipcRenderer.invoke('sftp:connect', id),
  download: (id: string, remotePath: string): Promise<void> =>
    ipcRenderer.invoke('sftp:download', id, remotePath),
  downloadDirect: (id: string, remotePath: string): Promise<void> =>
    ipcRenderer.invoke('sftp:downloadDirect', id, remotePath),
  upload: (id: string, remotePath: string): Promise<void> =>
    ipcRenderer.invoke('sftp:upload', id, remotePath),
  uploadFile: (id: string, localPath: string, remotePath: string): Promise<void> =>
    ipcRenderer.invoke('sftp:uploadFile', id, localPath, remotePath),
  dragDownload: (id: string, remotePath: string): void =>
    ipcRenderer.send('sftp:dragDownload', id, remotePath),
  // 监听来自主进程的数据事件
  onData: (callback: (event: { id: string; data: string }) => void): void => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }): void =>
      callback(data)
    ipcRenderer.on('ssh:data', handler)
  },
  onError: (callback: (event: { id: string; message: string }) => void): void => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { id: string; message: string }
    ): void => callback(data)
    ipcRenderer.on('ssh:error', handler)
  },
  onDisconnect: (callback: (event: { id: string }) => void): void => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string }): void =>
      callback(data)
    ipcRenderer.on('ssh:disconnect', handler)
  },
  // 清理所有传输事件监听
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners('transfer:progress')
    ipcRenderer.removeAllListeners('transfer:complete')
    ipcRenderer.removeAllListeners('transfer:error')
    ipcRenderer.removeAllListeners('transfer:dragready')
  },
  // 持久化存储 API
  getConnections: (): Promise<import('../main/ssh/types').SshConnection[]> =>
    ipcRenderer.invoke('store:getConnections'),
  saveConnections: (connections: import('../main/ssh/types').SshConnection[]): Promise<void> =>
    ipcRenderer.invoke('store:saveConnections', connections),
  getSettings: (): Promise<{ settings: { reopenTabs: boolean; autoFtp: boolean; useSystemTitleBar: boolean }; tabs: { name: string; config: import('../main/ssh/types').SshConnectionConfig; forkFrom?: string }[] }> =>
    ipcRenderer.invoke('store:getSettings'),
  saveSettings: (data: { settings: { reopenTabs: boolean; autoFtp: boolean; useSystemTitleBar: boolean }; tabs: { name: string; config: import('../main/ssh/types').SshConnectionConfig; forkFrom?: string }[] }): Promise<void> =>
    ipcRenderer.invoke('store:saveSettings', data),
  setZoomFactor: (factor: number): void => webFrame.setZoomFactor(factor),
  // 文件选择器
  openPrivateKey: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('dialog:openPrivateKey'),
  exportConnections: (data: string): Promise<boolean> =>
    ipcRenderer.invoke('dialog:exportConnections', data),
  importConnections: (): Promise<unknown> =>
    ipcRenderer.invoke('dialog:importConnections'),
  // 获取应用版本
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  // 获取框架版本
  getVersions: (): Promise<{ electron: string; chrome: string; node: string }> =>
    ipcRenderer.invoke('app:getVersions'),
  // 获取拖拽文件的本地路径
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  // 传输队列事件监听
  onTransferProgress: (callback: (data: {
    id: string; filename: string; type: 'upload' | 'download';
    transferred: number; total: number; speed: number
  }) => void): void => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data as any)
    ipcRenderer.on('transfer:progress', handler)
  },
  onTransferComplete: (callback: (data: { id: string }) => void): void => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data as any)
    ipcRenderer.on('transfer:complete', handler)
  },
  onTransferError: (callback: (data: { id: string; error: string }) => void): void => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data as any)
    ipcRenderer.on('transfer:error', handler)
  },
  onTransferDragReady: (callback: () => void): void => {
    ipcRenderer.on('transfer:dragready', () => callback())
  },
  // 窗口控制
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  unmaximize: (): Promise<void> => ipcRenderer.invoke('window:unmaximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  getPosition: (): Promise<[number, number]> => ipcRenderer.invoke('window:getPosition'),
  setPosition: (x: number, y: number): Promise<void> => ipcRenderer.invoke('window:setPosition', x, y)
}

const debug = {
  log: (...args: unknown[]): void => console.log('[renderer]', ...args),
  error: (...args: unknown[]): void => console.error('[renderer]', ...args)
}

// 根据 contextIsolation 状态决定如何暴露 API
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', sshApi)
    contextBridge.exposeInMainWorld('debug', debug)
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
