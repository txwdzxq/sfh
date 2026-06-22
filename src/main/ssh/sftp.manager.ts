import * as fs from 'fs'
import { SFTPWrapper } from 'ssh2'
import { SSHShellManager } from './shell.manager'
import { SftpEntry } from './types'

const CHUNK_SIZE = 256 * 1024
const CONCURRENCY = 16

interface ChunkInfo {
  start: number
  end: number
  done: boolean
  active: boolean
}

interface ControlledTransfer {
  sftp: SFTPWrapper
  handle: Buffer
  readStream?: NodeJS.ReadableStream & { pause(): NodeJS.ReadableStream; resume(): NodeJS.ReadableStream; destroy(): void }
  writeStream?: NodeJS.WritableStream & { destroy(): void }
  paused: boolean
  chunks?: ChunkInfo[]
  localFd?: number
  total?: number
  transferred?: number
  activeCount?: number
  cancelled?: boolean
  resolve?: () => void
  reject?: (e: Error) => void
  onProgress?: (t: number, total: number) => void
}

export class SFTPManager {
  private sftpSessions = new Map<string, SFTPWrapper>()
  private pendingSftp = new Map<string, Promise<SFTPWrapper>>()
  private controlledTransfers = new Map<string, ControlledTransfer>()

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

  async uploadControlled(
    id: string,
    localPath: string,
    remotePath: string,
    transferId: string,
    onProgress?: (t: number, total: number) => void
  ): Promise<void> {
    const sftp = await this.getSftp(id)
    const fs = require('fs') as typeof import('fs')
    return new Promise((resolve, reject) => {
      const stat = fs.statSync(localPath)
      const total = stat.size
      const readStream = fs.createReadStream(localPath)
      const writeStream = sftp.createWriteStream(remotePath)
      let transferred = 0
      const handle = Buffer.alloc(0)

      this.controlledTransfers.set(transferId, {
        sftp,
        handle,
        readStream,
        writeStream,
        paused: false
      })

      readStream.on('data', (chunk: string | Buffer) => {
        transferred += Buffer.byteLength(chunk)
        onProgress?.(transferred, total)
      })

      const cleanup = (): void => {
        this.controlledTransfers.delete(transferId)
      }

      writeStream.on('finish', () => {
        cleanup()
        resolve()
      })

      writeStream.on('error', (e) => {
        cleanup()
        reject(e)
      })

      readStream.on('error', (e) => {
        cleanup()
        writeStream.destroy()
        reject(e)
      })

      readStream.pipe(writeStream)
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

  async downloadControlled(
    id: string,
    remotePath: string,
    localPath: string,
    transferId: string,
    onProgress?: (t: number, total: number) => void,
    startOffset?: number
  ): Promise<void> {
    const self = this
    const sftp = await this.getSftp(id)
    return new Promise<void>((resolve, reject) => {
      sftp.open(remotePath, 'r', 0o644, (err, handle) => {
        if (err) return reject(err)
        sftp.fstat(handle, (err, stat) => {
          if (err) {
            sftp.close(handle, () => {})
            return reject(err)
          }

          const total = stat.size
          const offset = startOffset || 0
          const localFd = fs.openSync(localPath, offset > 0 ? 'r+' : 'w')
          let transferred = offset
          let activeCount = 0
          let cancelled = false
          let paused = false
          let completed = false

          const firstChunkIdx = Math.floor(offset / CHUNK_SIZE)
          const chunks: ChunkInfo[] = []
          for (let i = firstChunkIdx; i * CHUNK_SIZE < total; i++) {
            const start = i * CHUNK_SIZE
            chunks.push({ start, end: Math.min(start + CHUNK_SIZE - 1, total - 1), done: false, active: false })
          }

          const transfer: ControlledTransfer = {
            sftp, handle, paused: false,
            chunks, localFd, total, transferred, activeCount,
            cancelled: false, resolve, reject, onProgress
          }
          self.controlledTransfers.set(transferId, transfer)

          const cleanup = (): void => {
            self.controlledTransfers.delete(transferId)
            try { fs.closeSync(localFd) } catch {}
            sftp.close(handle, () => {})
          }

          const tryProcessNext = (): void => {
            if (cancelled || paused || completed) return

            while (activeCount < CONCURRENCY) {
              const chunk = chunks.find((c) => !c.done && !c.active)
              if (!chunk) break

              chunk.active = true
              activeCount++
              transfer.activeCount = activeCount

              const buf = Buffer.alloc(chunk.end - chunk.start + 1)
              sftp.read(handle, buf, 0, buf.length, chunk.start, (err, bytesRead) => {
                if (cancelled) return
                if (err) {
                  cleanup()
                  return reject(err)
                }

                if (bytesRead > 0) {
                  fs.write(localFd, buf, 0, bytesRead, chunk.start, (err) => {
                    if (cancelled) return
                    if (err) {
                      cleanup()
                      return reject(err)
                    }

                    chunk.done = true
                    chunk.active = false
                    activeCount--
                    transfer.activeCount = activeCount
                    transferred += bytesRead
                    transfer.transferred = transferred
                    onProgress?.(transferred, total)

                    if (!completed) tryProcessNext()
                  })
                } else {
                  chunk.done = true
                  chunk.active = false
                  activeCount--
                  transfer.activeCount = activeCount
                  if (!completed) tryProcessNext()
                }
              })
            }

            if (chunks.every((c) => c.done) && !completed) {
              completed = true
              cleanup()
              resolve()
            }
          }

          tryProcessNext()
        })
      })
    })
  }

  pauseTransfer(tid: string): boolean {
    const t = this.controlledTransfers.get(tid)
    if (!t || t.paused) return false
    if (t.chunks) {
      t.paused = true
    } else {
      t.readStream?.pause()
      t.paused = true
    }
    return true
  }

  resumeTransfer(tid: string): boolean {
    const t = this.controlledTransfers.get(tid)
    if (!t || !t.paused) return false
    if (t.chunks && !t.cancelled) {
      t.paused = false
      const self = this
      const transfer = t
      const tryProcessNext = (): void => {
        if (transfer.cancelled || transfer.paused) return
        const chunks = transfer.chunks!
        const sftp = transfer.sftp
        const handle = transfer.handle
        const localFd = transfer.localFd!
        const total = transfer.total!
        const onProgress = transfer.onProgress
        const concurrency = 16
        let activeCount = transfer.activeCount || 0
        let completed = false

        while (activeCount < concurrency) {
          const chunk = chunks.find((c: ChunkInfo) => !c.done && !c.active)
          if (!chunk) break

          chunk.active = true
          activeCount++
          transfer.activeCount = activeCount

          const buf = Buffer.alloc(chunk.end - chunk.start + 1)
          sftp.read(handle, buf, 0, buf.length, chunk.start, (err, bytesRead) => {
            if (transfer.cancelled) return
            if (err) {
              try { fs.closeSync(localFd) } catch {}
              sftp.close(handle, () => {})
              self.controlledTransfers.delete(tid)
              transfer.reject?.(err)
              return
            }

            if (bytesRead > 0) {
              fs.write(localFd, buf, 0, bytesRead, chunk.start, (err) => {
                if (transfer.cancelled) return
                if (err) {
                  try { fs.closeSync(localFd) } catch {}
                  sftp.close(handle, () => {})
                  self.controlledTransfers.delete(tid)
                  transfer.reject?.(err)
                  return
                }

                chunk.done = true
                chunk.active = false
                activeCount--
                transfer.activeCount = activeCount
                transfer.transferred = (transfer.transferred || 0) + bytesRead
                onProgress?.(transfer.transferred, total)

                if (!completed) tryProcessNext()
              })
            } else {
              chunk.done = true
              chunk.active = false
              activeCount--
              transfer.activeCount = activeCount
              if (!completed) tryProcessNext()
            }
          })
        }

        if (chunks.every((c: ChunkInfo) => c.done)) {
          completed = true
          try { fs.closeSync(localFd) } catch {}
          sftp.close(handle, () => {})
          self.controlledTransfers.delete(tid)
          transfer.resolve?.()
        }
      }
      tryProcessNext()
    } else {
      t.readStream?.resume()
      t.paused = false
    }
    return true
  }

  cancelTransfer(tid: string): boolean {
    const t = this.controlledTransfers.get(tid)
    if (!t) return false
    if (t.chunks) {
      t.cancelled = true
      if (t.localFd !== undefined) {
        try { fs.closeSync(t.localFd) } catch {}
      }
      t.sftp.close(t.handle, () => {})
      this.controlledTransfers.delete(tid)
    } else {
      t.readStream?.destroy()
      t.writeStream?.destroy()
      t.sftp.close(t.handle, () => {})
      this.controlledTransfers.delete(tid)
    }
    return true
  }

  cancelAllTransfers(): void {
    for (const [tid, t] of this.controlledTransfers) {
      if (t.chunks) {
        t.cancelled = true
        if (t.localFd !== undefined) {
          try { fs.closeSync(t.localFd) } catch {}
        }
      } else {
        t.readStream?.destroy()
        t.writeStream?.destroy()
      }
      t.sftp.close(t.handle, () => {})
      this.controlledTransfers.delete(tid)
    }
  }
}
