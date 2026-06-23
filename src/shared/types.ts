import type { SshConnectionConfig } from '../main/ssh/types'

export type Theme = 'mocha' | 'macchiato' | 'frappe' | 'latte'

export interface AppSettings {
  reopenTabs: boolean
  autoFtp: boolean
  useSystemTitleBar: boolean
  locale: string
  fontSize: number
  zoom: number
  theme: Theme
  windowWidth: number
  windowHeight: number
  windowX: number | null
  windowY: number | null
  windowMaximized: boolean
  defaultDownloadPath: string
  askDownloadLocation: boolean
  showQueueOnDownload: boolean
  sessionsPinned: boolean
  queuePinned: boolean
  downloadMode: 'chunk' | 'stream'
  opacity: number
}

export interface SavedTab {
  name: string
  config: SshConnectionConfig
}

export interface TransferItemData {
  id: string
  filename: string
  type: 'upload' | 'download'
  transferred: number
  total: number
  speed: number
  status: 'active' | 'completed' | 'error' | 'paused' | 'cancelled'
  error?: string
  localPath?: string
  tabId?: string
  remotePath?: string
  connectionKey?: string
  mode?: 'chunk' | 'stream'
}

export interface FtpBookmark {
  path: string
}

export interface SettingsData {
  settings: AppSettings
  tabs: SavedTab[]
  transfers?: TransferItemData[]
  ftpBookmarks?: FtpBookmark[]
}
