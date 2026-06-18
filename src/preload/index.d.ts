import { ElectronAPI } from '@electron-toolkit/preload'
import { SshConnectionConfig, SshConnection } from '../main/ssh/types'

interface SshApi {
  connect(id: string, config: SshConnectionConfig): Promise<void>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  disconnect(id: string): void
  readdir(id: string, path: string): Promise<import('../main/ssh/types').SftpEntry[]>
  realpath(id: string, path: string): Promise<string>
  connectSftp(id: string): Promise<void>
  download(id: string, remotePath: string): Promise<void>
  downloadDirect(id: string, remotePath: string): Promise<void>
  upload(id: string, remotePath: string): Promise<void>
  uploadFile(id: string, localPath: string, remotePath: string): Promise<void>
  dragDownload(id: string, remotePath: string): void
  onData(callback: (event: { id: string; data: string }) => void): () => void
  onError(callback: (event: { id: string; message: string }) => void): () => void
  onDisconnect(callback: (event: { id: string }) => void): () => void
  removeAllListeners(): void
  getConnections(): Promise<SshConnection[]>
  saveConnections(connections: SshConnection[]): Promise<void>
  getSettings(): Promise<{
    settings: { reopenTabs: boolean; autoFtp: boolean; useSystemTitleBar: boolean }
    tabs: { name: string; config: SshConnectionConfig }[]
  }>
  saveSettings(data: {
    settings: { reopenTabs: boolean; autoFtp: boolean; useSystemTitleBar: boolean }
    tabs: { name: string; config: SshConnectionConfig }[]
  }): Promise<void>
  openPrivateKey(): Promise<{ path: string; content: string } | null>
  exportConnections(data: string): Promise<boolean>
  importConnections(): Promise<unknown>
  getAppVersion(): Promise<string>
  getVersions(): Promise<{ electron: string; chrome: string; node: string }>
  getPathForFile(file: File): string
  onTransferProgress(
    callback: (data: {
      id: string
      filename: string
      type: 'upload' | 'download'
      transferred: number
      total: number
      speed: number
    }) => void
  ): () => void
  onTransferComplete(callback: (data: { id: string }) => void): () => void
  onTransferError(callback: (data: { id: string; error: string }) => void): () => void
  onTransferDragReady(callback: () => void): () => void
  minimize(): Promise<void>
  maximize(): Promise<void>
  unmaximize(): Promise<void>
  close(): Promise<void>
  isMaximized(): Promise<boolean>
  setZoomFactor(factor: number): void
  getPosition(): Promise<[number, number]>
  setPosition(x: number, y: number): Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: SshApi
  }
}
