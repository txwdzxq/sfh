import { Readable } from 'stream'
import type { SFTPWrapper } from 'ssh2'

export interface ParallelReadStreamOptions {
  concurrency?: number
  chunkSize?: number
}

export class ParallelReadStream extends Readable {
  private sftp: SFTPWrapper
  private handle: Buffer
  private total: number
  private nextOffset = 0
  private pushedOffset = 0
  private transferred = 0
  private activeReads = 0
  private pendingChunks = new Map<number, Buffer>()
  private concurrency: number
  private chunkSize: number
  private _ended = false
  private onProgress?: (transferred: number, total: number) => void

  constructor(
    sftp: SFTPWrapper,
    handle: Buffer,
    total: number,
    onProgress?: (transferred: number, total: number) => void,
    opts?: ParallelReadStreamOptions
  ) {
    const chunkSize = opts?.chunkSize ?? 256 * 1024
    super({ highWaterMark: chunkSize })
    this.sftp = sftp
    this.handle = handle
    this.total = total
    this.concurrency = opts?.concurrency ?? 16
    this.chunkSize = chunkSize
    this.onProgress = onProgress
  }

  _read(): void {
    this.pushPending()
    this.checkEnd()
    this.fill()
  }

  private fill(): void {
    if (this.destroyed) return
    while (this.activeReads < this.concurrency && this.nextOffset < this.total) {
      const offset = this.nextOffset
      const len = Math.min(this.chunkSize, this.total - offset)
      this.nextOffset += len
      this.activeReads++

      const buf = Buffer.alloc(len)
      this.sftp.read(this.handle, buf, 0, len, offset, (err, bytesRead) => {
        if (this.destroyed) return
        this.activeReads--

        if (err) {
          this.destroy(err)
          return
        }

        if (bytesRead > 0) {
          this.transferred += bytesRead
          this.onProgress?.(this.transferred, this.total)

          if (bytesRead === buf.length) {
            this.pendingChunks.set(offset, buf)
          } else {
            this.pendingChunks.set(offset, buf.subarray(0, bytesRead))
          }

          this.pushPending()
          this.checkEnd()
          this.fill()
        } else {
          this.pushPending()
          this.checkEnd()
        }
      })
    }
  }

  private pushPending(): void {
    while (this.pendingChunks.has(this.pushedOffset)) {
      const chunk = this.pendingChunks.get(this.pushedOffset)!
      this.pendingChunks.delete(this.pushedOffset)
      this.pushedOffset += chunk.length
      if (this.push(chunk) === false) {
        return
      }
    }
  }

  private checkEnd(): void {
    if (this._ended) return
    if (this.activeReads === 0 && this.pushedOffset >= this.total) {
      this._ended = true
      this.push(null)
    }
  }

  _destroy(err: Error | null, cb: (err: Error | null) => void): void {
    this.pendingChunks.clear()
    this.sftp.close(this.handle, () => {})
    cb(err)
  }
}
