import { SFTPWrapper } from 'ssh2'
import { SSHShellManager } from './shell.manager'
import { SftpEntry } from './manager' // Reuse existing interface

export class SFTPManager {
  private sftpSessions = new Map<string, SFTPWrapper>()
  
  constructor(private shellManager: SSHShellManager) {}

  async connectSftp(id: string): Promise<void> {
    await this.getSftp(id)
  }

  async readdir(id: string, path: string): Promise<SftpEntry[]> {
    const sftp = await this.getSftp(id)
    return new Promise((resolve, reject) => {
      sftp.readdir(path, (err, list) => {
        if (err) reject(err)
        else {
          resolve(list.map(item => ({
            filename: item.filename,
            longname: item.longname,
            type: item.attrs.isDirectory() ? 'directory' : 'file',
            size: item.attrs.size,
            mode: item.attrs.mode,
            uid: item.attrs.uid,
            gid: item.attrs.gid,
            atime: item.attrs.atime,
            mtime: item.attrs.mtime
          } as SftpEntry)))
        }
      })
    })
  }

  private async getSftp(id: string): Promise<SFTPWrapper> {
    if (this.sftpSessions.has(id)) {
      const sftp = this.sftpSessions.get(id)!
      // 检查 sftp 连接是否仍然有效
      if (sftp) return sftp
    }
    
    const session = this.shellManager.getSession(id)
    if (!session) throw new Error('SSH session not found')
    
    // 增加对 client 连接状态的检查
    if (!session.client) throw new Error('SSH client is not initialized')

    return new Promise((resolve, reject) => {
      session.client.sftp((err, sftp) => {
        if (err) {
          console.error(`[ssh] sftp create error for ${id}:`, err.message)
          reject(err)
        } else {
          this.sftpSessions.set(id, sftp)
          sftp.on('close', () => {
            this.sftpSessions.delete(id)
          })
          console.log(`[ssh] sftp ready for ${id}`)
          resolve(sftp)
        }
      })
    })
  }

  async realpath(id: string, path: string): Promise<string> {
    const sftp = await this.getSftp(id)
    return new Promise((resolve, reject) => {
      sftp.realpath(path, (err, absPath) => {
        if (err) reject(err)
        else resolve(absPath)
      })
    })
  }

  async upload(id: string, localPath: string, remotePath: string, onProgress?: (t: number, total: number) => void): Promise<void> {
    const sftp = await this.getSftp(id)
    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, {
        step: (transferred, _chunk, total) => onProgress?.(transferred, total)
      }, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async download(id: string, remotePath: string, localPath: string, onProgress?: (t: number, total: number) => void): Promise<void> {
    const sftp = await this.getSftp(id)
    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, {
        step: (transferred, _chunk, total) => onProgress?.(transferred, total)
      }, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}
