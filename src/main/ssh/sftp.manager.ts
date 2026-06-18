import { SFTPWrapper } from 'ssh2'
import { SSHShellManager } from './shell.manager'
import { SftpEntry } from './types'

export class SFTPManager {
  private sftpSessions = new Map<string, SFTPWrapper>()
  private pendingSftp = new Map<string, Promise<SFTPWrapper>>()

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
          resolve(
            list.map(
              (item) =>
                ({
                  filename: item.filename,
                  longname: item.longname,
                  type: item.attrs.isDirectory() ? 'directory' : 'file',
                  size: item.attrs.size,
                  mode: item.attrs.mode,
                  uid: item.attrs.uid,
                  gid: item.attrs.gid,
                  atime: item.attrs.atime,
                  mtime: item.attrs.mtime
                }) as SftpEntry
            )
          )
        }
      })
    })
  }

  private async getSftp(id: string): Promise<SFTPWrapper> {
    if (this.sftpSessions.has(id)) return this.sftpSessions.get(id)!
    if (this.pendingSftp.has(id)) return this.pendingSftp.get(id)!

    const session = this.shellManager.getSession(id)
    if (!session) throw new Error('SSH session not found')
    if (!session.client) throw new Error('SSH client is not initialized')

    const promise = new Promise<SFTPWrapper>((resolve, reject) => {
      session.client.sftp((err, sftp) => {
        if (err) {
          this.pendingSftp.delete(id)
          console.error(`[ssh] sftp create error for ${id}:`, err.message)
          reject(err)
        } else {
          this.sftpSessions.set(id, sftp)
          this.pendingSftp.delete(id)
          sftp.on('close', () => this.sftpSessions.delete(id))
          resolve(sftp)
        }
      })
    })
    this.pendingSftp.set(id, promise)
    return promise
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

  async upload(
    id: string,
    localPath: string,
    remotePath: string,
    onProgress?: (t: number, total: number) => void
  ): Promise<void> {
    const sftp = await this.getSftp(id)
    return new Promise((resolve, reject) => {
      sftp.fastPut(
        localPath,
        remotePath,
        {
          step: (transferred, _chunk, total) => onProgress?.(transferred, total)
        },
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }

  async download(
    id: string,
    remotePath: string,
    localPath: string,
    onProgress?: (t: number, total: number) => void
  ): Promise<void> {
    const sftp = await this.getSftp(id)
    return new Promise((resolve, reject) => {
      sftp.fastGet(
        remotePath,
        localPath,
        {
          step: (transferred, _chunk, total) => onProgress?.(transferred, total)
        },
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }
}
