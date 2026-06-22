// SSH IPC 处理器 — 桥接渲染进程请求到 ssh2 引擎，并将数据事件推送给渲染进程

import { ipcMain, BrowserWindow, dialog, app, shell, nativeImage } from 'electron'
import * as path from 'path'
import { existsSync } from 'fs'
import { IPC } from '../../shared/ipcChannels'
import { sshManager } from '../ssh/manager'
import { SshConnectionConfig } from '../ssh/types'
import { loadSettings } from './store'

/** 验证 SSH 连接配置 */
function validateConfig(config: SshConnectionConfig): void {
  if (!config || typeof config !== 'object') throw new Error('Invalid config')
  if (!config.host || typeof config.host !== 'string') throw new Error('Invalid host')
  if (!config.port || typeof config.port !== 'number' || config.port < 1 || config.port > 65535)
    throw new Error('Invalid port')
  if (!config.username || typeof config.username !== 'string') throw new Error('Invalid username')
}

/** 验证远程路径（防止空路径） */
function validateRemotePath(p: string): void {
  if (!p || typeof p !== 'string') throw new Error('Invalid path')
}

/** 清理 ssh2 错误消息，防止泄漏敏感信息 */
function sanitizeSshError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('connect ECONNREFUSED') || msg.includes('connect EHOSTUNREACH'))
    return new Error('Connection refused')
  if (msg.includes('Timed out')) return new Error('Connection timed out')
  if (msg.includes('Authentication') && msg.includes('failed'))
    return new Error('Authentication failed')
  if (msg.includes('ENOENT') || msg.includes('No such file'))
    return new Error('Remote path not found')
  if (msg.includes('Permission denied')) return new Error('Permission denied')
  return err instanceof Error ? err : new Error(msg)
}

/** 生成不重复的本地文件路径（重名时追加 (N) 后缀） */
function uniqueLocalPath(dir: string, filename: string): string {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let result = path.join(dir, filename)
  if (!existsSync(result)) return result
  let n = 1
  while (existsSync(result)) {
    result = path.join(dir, `${base} (${n})${ext}`)
    n++
  }
  return result
}

/** 生成简短唯一传输 ID */
function transferId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

/** 传输 ID 到本地路径的映射（用于下载完成后的打开文件夹按钮） */
const transferLocalPaths = new Map<string, string>()

/** 发送进度事件到所有窗口 */
function sendProgress(payload: {
  id: string
  filename: string
  type: 'upload' | 'download'
  transferred: number
  total: number
  speed: number
  tabId?: string
  remotePath?: string
  localPath?: string
  connectionKey?: string
}): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(IPC.TRANSFER_PROGRESS, payload)
  })
}

/** 发送传输完成事件 */
function sendComplete(id: string): void {
  const localPath = transferLocalPaths.get(id)
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(IPC.TRANSFER_COMPLETE, { id, localPath })
  })
  transferLocalPaths.delete(id)
}

/** 发送传输错误事件 */
function sendError(id: string, error: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(IPC.TRANSFER_ERROR, { id, error })
  })
}

/** 逐秒计算传输速度的辅助函数 */
function createSpeedTracker(): {
  (transferred: number): number
} {
  let lastBytes = 0
  let lastTime = Date.now()
  let speed = 0
  return (transferred: number): number => {
    const now = Date.now()
    const elapsed = (now - lastTime) / 1000
    if (elapsed >= 1) {
      speed = (transferred - lastBytes) / elapsed
      lastBytes = transferred
      lastTime = now
    }
    return speed
  }
}

export function registerSshIpc(): void {
  // 注册引擎回调：将 ssh2 事件广播到所有窗口（渲染进程）
  sshManager.setHandlers({
    onData: (id, data) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(IPC.SSH_DATA, { id, data })
      })
    },
    onError: (id, message) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(IPC.SSH_ERROR, { id, message })
      })
    },
    onDisconnect: (id) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(IPC.SSH_DISCONNECT, { id })
      })
    }
  })

  // invoke/handle 模式：连接（等待结果）
  ipcMain.handle(
    IPC.SSH_CONNECT,
    async (_event, id: string, config: SshConnectionConfig): Promise<void> => {
      if (!id || typeof id !== 'string') throw new Error('Invalid id')
      validateConfig(config)
      console.log(`[ipc] ssh:connect id=${id}`)
      try {
        await sshManager.connect(id, config)
      } catch (err) {
        throw sanitizeSshError(err)
      }
    }
  )

  // send/on 模式：写入、调整尺寸、断开（无需等待结果）
  ipcMain.on(IPC.SSH_WRITE, (_event, id: string, data: string) => {
    if (!id || typeof id !== 'string') return
    sshManager.write(id, data)
  })

  ipcMain.on(IPC.SSH_RESIZE, (_event, id: string, cols: number, rows: number) => {
    if (!id || typeof id !== 'string') return
    sshManager.resize(id, cols, rows)
  })

  ipcMain.on(IPC.SSH_DISCONNECT, (_event, id: string) => {
    if (!id || typeof id !== 'string') return
    console.log(`[ipc] ssh:disconnect id=${id}`)
    sshManager.disconnect(id)
  })

  ipcMain.handle(
    IPC.SFTP_READDIR,
    async (_event, id: string, p: string): Promise<ReturnType<typeof sshManager.readdir>> => {
      validateRemotePath(p)
      console.log(`[ipc] sftp:readdir id=${id} path=${p}`)
      try {
        return await sshManager.readdir(id, p)
      } catch (err) {
        throw sanitizeSshError(err)
      }
    }
  )

  ipcMain.handle(IPC.SFTP_REALPATH, async (_event, id: string, p: string): Promise<string> => {
    validateRemotePath(p)
    console.log(`[ipc] sftp:realpath id=${id} path=${p}`)
    try {
      return await sshManager.realpath(id, p)
    } catch (err) {
      throw sanitizeSshError(err)
    }
  })

  ipcMain.handle(
    IPC.SFTP_DOWNLOAD,
    async (_event, id: string, remotePath: string): Promise<void> => {
      validateRemotePath(remotePath)
      const settings = loadSettings()
      const filename = remotePath.split('/').pop() || 'download'
      let localPath: string
      if (settings.settings.askDownloadLocation) {
        const result = await dialog.showSaveDialog({ defaultPath: filename })
        if (result.canceled || !result.filePath) return
        localPath = result.filePath
      } else {
        const downloadDir = settings.settings.defaultDownloadPath || app.getPath('downloads')
        localPath = uniqueLocalPath(downloadDir, filename)
      }
      const localFilename = localPath.replace(/\\/g, '/').split('/').pop() || filename
      const tid = transferId()
      transferLocalPaths.set(tid, localPath)
      const connKey = sshManager.getConnectionKey(id)
      sendProgress({
        id: tid,
        filename: localFilename,
        type: 'download',
        transferred: 0,
        total: 0,
        speed: 0,
        tabId: id,
        remotePath,
        localPath,
        connectionKey: connKey
      })
      const trackSpeed = createSpeedTracker()
      console.log(`[ipc] sftp:download ${remotePath} → ${localPath}`)
      try {
        await sshManager.downloadControlled(id, remotePath, localPath, tid, (transferred, total) => {
          const speed = trackSpeed(transferred)
          sendProgress({
            id: tid,
            filename: localFilename,
            type: 'download',
            transferred,
            total,
            speed,
            tabId: id,
            remotePath,
            localPath,
            connectionKey: connKey
          })
        })
        sendComplete(tid)
      } catch (err) {
        sendError(tid, sanitizeSshError(err).message)
        throw sanitizeSshError(err)
      }
    }
  )

  ipcMain.handle(IPC.SFTP_UPLOAD, async (_event, id: string, remoteDir: string): Promise<void> => {
    validateRemotePath(remoteDir)
    const result = await dialog.showOpenDialog({
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return
    const localPath = result.filePaths[0]
    const filename = localPath.replace(/\\/g, '/').split('/').pop() || 'file'
    const remotePath = (remoteDir === '.' ? '' : remoteDir) + '/' + filename
    const tid = transferId()
    sendProgress({ id: tid, filename, type: 'upload', transferred: 0, total: 0, speed: 0 })
    const trackSpeed = createSpeedTracker()
    console.log(`[ipc] sftp:upload ${localPath} → ${remotePath}`)
    try {
      await sshManager.uploadControlled(id, localPath, remotePath, tid, (transferred, total) => {
        const speed = trackSpeed(transferred)
        sendProgress({ id: tid, filename, type: 'upload', transferred, total, speed })
      })
      sendComplete(tid)
    } catch (err) {
      sendError(tid, sanitizeSshError(err).message)
      throw sanitizeSshError(err)
    }
  })

  ipcMain.handle(
    IPC.SFTP_UPLOAD_FILE,
    async (_event, id: string, localPath: string, remotePath: string): Promise<void> => {
      validateRemotePath(remotePath)
      if (!localPath || typeof localPath !== 'string') throw new Error('Invalid local path')
      const filename = remotePath.split('/').pop() || 'file'
      const tid = transferId()
      sendProgress({ id: tid, filename, type: 'upload', transferred: 0, total: 0, speed: 0 })
      const trackSpeed = createSpeedTracker()
      console.log(`[ipc] sftp:uploadFile ${localPath} → ${remotePath}`)
      try {
        await sshManager.uploadControlled(id, localPath, remotePath, tid, (transferred, total) => {
          const speed = trackSpeed(transferred)
          sendProgress({ id: tid, filename, type: 'upload', transferred, total, speed })
        })
        sendComplete(tid)
      } catch (err) {
        sendError(tid, sanitizeSshError(err).message)
        throw sanitizeSshError(err)
      }
    }
  )

  // send/on: 拖拽下载 — 下载到临时目录后启动原生文件拖拽
  ipcMain.on(IPC.SFTP_DRAG_DOWNLOAD, async (event, id: string, remotePath: string) => {
    validateRemotePath(remotePath)
    const filename = remotePath.split('/').pop() || 'download'
    const localPath = path.join(app.getPath('temp'), filename)
    console.log(`[ipc] sftp:dragDownload ${remotePath} → ${localPath}`)
    try {
      await sshManager.download(id, remotePath, localPath)
    } catch (err) {
      console.error(`[ipc] dragDownload failed:`, sanitizeSshError(err).message)
      return
    }
    event.sender.startDrag({
      file: localPath,
      icon: nativeImage.createEmpty()
    })
    event.sender.send(IPC.TRANSFER_DRAG_READY)
  })

  ipcMain.handle(IPC.SFTP_CONNECT, async (_event, id: string): Promise<void> => {
    if (!id || typeof id !== 'string') throw new Error('Invalid id')
    try {
      await sshManager.connectSftp(id)
    } catch (err) {
      throw sanitizeSshError(err)
    }
  })

  ipcMain.handle(
    IPC.SFTP_DOWNLOAD_DIRECT,
    async (_event, id: string, remotePath: string): Promise<void> => {
      validateRemotePath(remotePath)
      const settings = loadSettings()
      const downloadDir = settings.settings.defaultDownloadPath || app.getPath('downloads')
      const filename = remotePath.split('/').pop() || 'download'
      const localPath = path.join(downloadDir, filename)
      const localFilename = localPath.replace(/\\/g, '/').split('/').pop() || filename
      const tid = transferId()
      transferLocalPaths.set(tid, localPath)
      sendProgress({
        id: tid,
        filename: localFilename,
        type: 'download',
        transferred: 0,
        total: 0,
        speed: 0,
        tabId: id,
        remotePath
      })
      const trackSpeed = createSpeedTracker()
      console.log(`[ipc] sftp:downloadDirect ${remotePath} → ${localPath}`)
      try {
        await sshManager.download(id, remotePath, localPath, (transferred, total) => {
          const speed = trackSpeed(transferred)
          sendProgress({
            id: tid,
            filename: localFilename,
            type: 'download',
            transferred,
            total,
            speed,
            tabId: id,
            remotePath
          })
        })
        sendComplete(tid)
      } catch (err) {
        sendError(tid, sanitizeSshError(err).message)
        throw sanitizeSshError(err)
      }
    }
  )

  ipcMain.handle(IPC.SHELL_SHOW_ITEM, async (_event, localPath: string): Promise<void> => {
    shell.showItemInFolder(localPath)
  })

  ipcMain.on(IPC.TRANSFER_PAUSE, (_event, tid: string) => {
    if (!tid || typeof tid !== 'string') return
    console.log(`[ipc] transfer:pause ${tid}`)
    sshManager.pauseTransfer(tid)
  })

  ipcMain.on(IPC.TRANSFER_RESUME, (_event, tid: string, tabId?: string, remotePath?: string, localPath?: string, offset?: number, connectionKey?: string) => {
    if (!tid || typeof tid !== 'string') return
    console.log(`[ipc] transfer:resume ${tid}`)
    const resumed = sshManager.resumeTransfer(tid)
    if (!resumed && remotePath && localPath && offset !== undefined) {
      let activeId = tabId
      if (!activeId || !sshManager.hasSession(activeId)) {
        if (connectionKey) {
          activeId = sshManager.findSessionByConnectionKey(connectionKey)
        }
      }
      if (!activeId || !sshManager.hasSession(activeId)) {
        console.log(`[ipc] transfer:resume failed — no matching active session`)
        sendError(tid, 'SSH 连接已断开，请先重新连接')
        return
      }
      console.log(`[ipc] transfer:resume starting new download ${remotePath} → ${localPath} at offset ${offset} via session ${activeId}`)
      const trackSpeed = createSpeedTracker()
      const connKey = sshManager.getConnectionKey(activeId)
      sendProgress({
        id: tid,
        filename: localPath.replace(/\\/g, '/').split('/').pop() || 'file',
        type: 'download',
        transferred: offset,
        total: 0,
        speed: 0,
        tabId: activeId,
        remotePath,
        localPath,
        connectionKey: connKey
      })
      sshManager.downloadControlled(activeId, remotePath, localPath, tid, (transferred, total) => {
        const speed = trackSpeed(transferred)
        sendProgress({ id: tid, filename: localPath.replace(/\\/g, '/').split('/').pop() || 'file', type: 'download', transferred, total, speed, tabId: activeId, remotePath, localPath, connectionKey: connKey })
      }, offset).then(() => {
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(IPC.TRANSFER_COMPLETE, { id: tid, localPath })
        })
      }).catch((err) => {
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(IPC.TRANSFER_ERROR, { id: tid, error: sanitizeSshError(err).message })
        })
      })
    }
  })

  ipcMain.on(IPC.TRANSFER_CANCEL, (_event, tid: string) => {
    if (!tid || typeof tid !== 'string') return
    console.log(`[ipc] transfer:cancel ${tid}`)
    sshManager.cancelTransfer(tid)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC.TRANSFER_CANCELLED, { id: tid })
    })
  })

  ipcMain.on(IPC.TRANSFER_CANCEL_ALL, () => {
    console.log(`[ipc] transfer:cancelAll`)
    sshManager.cancelAllTransfers()
  })
}
