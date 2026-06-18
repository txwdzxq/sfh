import { SshConnectionConfig } from './types'
import { SSHShellManager } from './shell.manager'
import { SFTPManager } from './sftp.manager'
import { SftpEntry } from './manager'

export class SshManager {
  private shellManager: SSHShellManager
  private sftpManager: SFTPManager

  constructor() {
    this.shellManager = new SSHShellManager()
    this.sftpManager = new SFTPManager(this.shellManager)
  }

  setHandlers(handlers: {
    onData: (id: string, data: string) => void
    onError: (id: string, message: string) => void
    onDisconnect: (id: string) => void
  }): void {
    this.shellManager.onData = handlers.onData
    this.shellManager.onError = handlers.onError
    this.shellManager.onDisconnect = handlers.onDisconnect
  }

  async connect(id: string, config: SshConnectionConfig): Promise<void> {
    await this.shellManager.connect(id, config)
  }

  async forkShell(sourceId: string, newId: string): Promise<void> {
    // 简化实现：重用现有的 client
    const session = this.shellManager.getSession(sourceId)
    if (!session) throw new Error('Source session not found')
    // 在实际代码中，SSHShellManager 需要实现 forkShell 逻辑
    // 为了兼容，这里仅做代理调用，后续可在 ShellManager 中实现
    await (this.shellManager as any).forkShell?.(sourceId, newId)
  }

  write(id: string, data: string): void {
    this.shellManager.write(id, data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.shellManager.resize(id, cols, rows)
  }

  disconnect(id: string): void {
    this.shellManager.disconnect(id)
  }

  // SFTP 代理
  async connectSftp(id: string): Promise<void> {
    await this.sftpManager.connectSftp(id)
  }

  async readdir(id: string, path: string): Promise<SftpEntry[]> {
    return await this.sftpManager.readdir(id, path)
  }

  async realpath(id: string, path: string): Promise<string> {
    return await this.sftpManager.realpath(id, path)
  }
  
  async upload(id: string, localPath: string, remotePath: string, onProgress?: (t: number, total: number) => void): Promise<void> {
    return await this.sftpManager.upload(id, localPath, remotePath, onProgress)
  }
  
  async download(id: string, remotePath: string, localPath: string, onProgress?: (t: number, total: number) => void): Promise<void> {
    return await this.sftpManager.download(id, remotePath, localPath, onProgress)
  }
}

export const sshManager = new SshManager()
