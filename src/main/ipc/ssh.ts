// SSH IPC 处理器 — 桥接渲染进程请求到 ssh2 引擎，并将数据事件推送给渲染进程

import { ipcMain, BrowserWindow, dialog, app, nativeImage } from 'electron'
import * as path from 'path'
import { sshManager } from '../ssh/manager'
import { SshConnectionConfig } from '../ssh/types'

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

/** 生成简短唯一传输 ID */
function transferId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

/** 发送进度事件到所有窗口 */
function sendProgress(payload: {
  id: string
  filename: string
  type: 'upload' | 'download'
  transferred: number
  total: number
  speed: number
}): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('transfer:progress', payload)
  })
}

/** 发送传输完成事件 */
function sendComplete(id: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('transfer:complete', { id })
  })
}

/** 发送传输错误事件 */
function sendError(id: string, error: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('transfer:error', { id, error })
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
        win.webContents.send('ssh:data', { id, data })
      })
    },
    onError: (id, message) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('ssh:error', { id, message })
      })
    },
    onDisconnect: (id) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('ssh:disconnect', { id })
      })
    }
  })

  // invoke/handle 模式：连接（等待结果）
  ipcMain.handle(
    'ssh:connect',
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
  ipcMain.on('ssh:write', (_event, id: string, data: string) => {
    if (!id || typeof id !== 'string') return
    sshManager.write(id, data)
  })

  ipcMain.on('ssh:resize', (_event, id: string, cols: number, rows: number) => {
    if (!id || typeof id !== 'string') return
    sshManager.resize(id, cols, rows)
  })

  ipcMain.on('ssh:disconnect', (_event, id: string) => {
    if (!id || typeof id !== 'string') return
    console.log(`[ipc] ssh:disconnect id=${id}`)
    sshManager.disconnect(id)
  })

  ipcMain.handle(
    'sftp:readdir',
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

  ipcMain.handle('sftp:realpath', async (_event, id: string, p: string): Promise<string> => {
    validateRemotePath(p)
    console.log(`[ipc] sftp:realpath id=${id} path=${p}`)
    try {
      return await sshManager.realpath(id, p)
    } catch (err) {
      throw sanitizeSshError(err)
    }
  })

  ipcMain.handle('sftp:download', async (_event, id: string, remotePath: string): Promise<void> => {
    validateRemotePath(remotePath)
    const result = await dialog.showSaveDialog({
      defaultPath: remotePath.split('/').pop() || 'download'
    })
    if (result.canceled || !result.filePath) return
    const filename = remotePath.split('/').pop() || 'download'
    const tid = transferId()
    const trackSpeed = createSpeedTracker()
    console.log(`[ipc] sftp:download ${remotePath} → ${result.filePath}`)
    try {
      await sshManager.download(id, remotePath, result.filePath, (transferred, total) => {
        const speed = trackSpeed(transferred)
        sendProgress({ id: tid, filename, type: 'download', transferred, total, speed })
      })
      sendComplete(tid)
    } catch (err) {
      sendError(tid, sanitizeSshError(err).message)
      throw sanitizeSshError(err)
    }
  })

  ipcMain.handle('sftp:upload', async (_event, id: string, remoteDir: string): Promise<void> => {
    validateRemotePath(remoteDir)
    const result = await dialog.showOpenDialog({
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return
    const localPath = result.filePaths[0]
    const filename = localPath.replace(/\\/g, '/').split('/').pop() || 'file'
    const remotePath = (remoteDir === '.' ? '' : remoteDir) + '/' + filename
    const tid = transferId()
    const trackSpeed = createSpeedTracker()
    console.log(`[ipc] sftp:upload ${localPath} → ${remotePath}`)
    try {
      await sshManager.upload(id, localPath, remotePath, (transferred, total) => {
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
    'sftp:uploadFile',
    async (_event, id: string, localPath: string, remotePath: string): Promise<void> => {
      validateRemotePath(remotePath)
      if (!localPath || typeof localPath !== 'string') throw new Error('Invalid local path')
      const filename = remotePath.split('/').pop() || 'file'
      const tid = transferId()
      const trackSpeed = createSpeedTracker()
      console.log(`[ipc] sftp:uploadFile ${localPath} → ${remotePath}`)
      try {
        await sshManager.upload(id, localPath, remotePath, (transferred, total) => {
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
  ipcMain.on('sftp:dragDownload', async (event, id: string, remotePath: string) => {
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
    event.sender.send('transfer:dragready')
  })

  ipcMain.handle('sftp:connect', async (_event, id: string): Promise<void> => {
    if (!id || typeof id !== 'string') throw new Error('Invalid id')
    try {
      await sshManager.connectSftp(id)
    } catch (err) {
      throw sanitizeSshError(err)
    }
  })

  ipcMain.handle(
    'sftp:downloadDirect',
    async (_event, id: string, remotePath: string): Promise<void> => {
      validateRemotePath(remotePath)
      const filename = remotePath.split('/').pop() || 'download'
      const localPath = path.join(app.getPath('downloads'), filename)
      const tid = transferId()
      const trackSpeed = createSpeedTracker()
      console.log(`[ipc] sftp:downloadDirect ${remotePath} → ${localPath}`)
      try {
        await sshManager.download(id, remotePath, localPath, (transferred, total) => {
          const speed = trackSpeed(transferred)
          sendProgress({ id: tid, filename, type: 'download', transferred, total, speed })
        })
        sendComplete(tid)
      } catch (err) {
        sendError(tid, sanitizeSshError(err).message)
        throw sanitizeSshError(err)
      }
    }
  )
}
