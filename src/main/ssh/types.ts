export interface SshConnectionConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  readyTimeout?: number
  keepaliveInterval?: number
  keepaliveCountMax?: number
  execCommand?: string
}

export interface SshConnection {
  id: string
  config: SshConnectionConfig
  name: string
  group?: string
  createdAt: number
}

export interface SshDataEvent {
  id: string
  data: string
}

export interface SshErrorEvent {
  id: string
  message: string
}

export interface SshDisconnectEvent {
  id: string
  reason?: string
}

export interface SftpEntry {
  filename: string
  longname: string
  type: 'directory' | 'file'
  size: number
  mode: number
  uid: number
  gid: number
  atime: number
  mtime: number
}
