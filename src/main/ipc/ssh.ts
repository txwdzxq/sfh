// SSH IPC 处理器 — 桥接渲染进程请求到 ssh2 引擎，并将数据事件推送给渲染进程

import { ipcMain, BrowserWindow, dialog, app, nativeImage } from 'electron'
import * as path from 'path'
import { sshManager } from '../ssh/manager'
import { SshConnectionConfig } from '../ssh/types'

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
      console.log(`[ipc] ssh:connect id=${id} ${config.username}@${config.host}:${config.port}`)
      await sshManager.connect(id, config)
    }
  )

  // send/on 模式：写入、调整尺寸、断开（无需等待结果）
  ipcMain.on('ssh:write', (_event, id: string, data: string) => {
    sshManager.write(id, data)
  })

  ipcMain.on('ssh:resize', (_event, id: string, cols: number, rows: number) => {
    sshManager.resize(id, cols, rows)
  })

  ipcMain.on('ssh:disconnect', (_event, id: string) => {
    console.log(`[ipc] ssh:disconnect id=${id}`)
    sshManager.disconnect(id)
  })

  ipcMain.handle(
    'ssh:fork',
    async (_event, sourceId: string, newId: string): Promise<void> => {
      console.log(`[ipc] ssh:fork source=${sourceId} new=${newId}`)
      await sshManager.forkShell(sourceId, newId)
    }
  )

  ipcMain.handle(
    'sftp:readdir',
    async (_event, id: string, path: string): Promise<ReturnType<typeof sshManager.readdir>> => {
      console.log(`[ipc] sftp:readdir id=${id} path=${path}`)
      return await sshManager.readdir(id, path)
    }
  )

  ipcMain.handle(
    'sftp:realpath',
    async (_event, id: string, path: string): Promise<string> => {
      console.log(`[ipc] sftp:realpath id=${id} path=${path}`)
      return await sshManager.realpath(id, path)
    }
  )

  ipcMain.handle(
    'sftp:download',
    async (event, id: string, remotePath: string): Promise<void> => {
      const result = await dialog.showSaveDialog({
        defaultPath: remotePath.split('/').pop() || 'download'
      })
      if (result.canceled || !result.filePath) return
      const filename = remotePath.split('/').pop() || 'download'
      const tid = transferId()
      const trackSpeed = createSpeedTracker()
      console.log(`[ipc] sftp:download ${remotePath} → ${result.filePath}`)
      await sshManager.download(id, remotePath, result.filePath, (transferred, total) => {
        const speed = trackSpeed(transferred)
        sendProgress({ id: tid, filename, type: 'download', transferred, total, speed })
      })
      sendComplete(tid)
    }
  )

  ipcMain.handle(
    'sftp:upload',
    async (_event, id: string, remoteDir: string): Promise<void> => {
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
      await sshManager.upload(id, localPath, remotePath, (transferred, total) => {
        const speed = trackSpeed(transferred)
        sendProgress({ id: tid, filename, type: 'upload', transferred, total, speed })
      })
      sendComplete(tid)
    }
  )

  ipcMain.handle(
    'sftp:uploadFile',
    async (event, id: string, localPath: string, remotePath: string): Promise<void> => {
      const filename = remotePath.split('/').pop() || 'file'
      const tid = transferId()
      const trackSpeed = createSpeedTracker()
      console.log(`[ipc] sftp:uploadFile ${localPath} → ${remotePath}`)
      await sshManager.upload(id, localPath, remotePath, (transferred, total) => {
        const speed = trackSpeed(transferred)
        sendProgress({ id: tid, filename, type: 'upload', transferred, total, speed })
      })
      sendComplete(tid)
    }
  )

  // send/on: 拖拽下载 — 下载到临时目录后启动原生文件拖拽
  ipcMain.on('sftp:dragDownload', async (event, id: string, remotePath: string) => {
    const filename = remotePath.split('/').pop() || 'download'
    const localPath = path.join(app.getPath('temp'), filename)
    console.log(`[ipc] sftp:dragDownload ${remotePath} → ${localPath}`)
    await sshManager.download(id, remotePath, localPath)
    event.sender.startDrag({
      file: localPath,
      icon: nativeImage.createEmpty()
    })
    event.sender.send('transfer:dragready')
  })

  ipcMain.handle(
    'sftp:connect',
    async (_event, id: string): Promise<void> => {
      await sshManager.connectSftp(id)
    }
  )

  ipcMain.handle(
    'sftp:downloadDirect',
    async (event, id: string, remotePath: string): Promise<void> => {
      const filename = remotePath.split('/').pop() || 'download'
      const localPath = path.join(app.getPath('downloads'), filename)
      const tid = transferId()
      const trackSpeed = createSpeedTracker()
      console.log(`[ipc] sftp:downloadDirect ${remotePath} → ${localPath}`)
      await sshManager.download(id, remotePath, localPath, (transferred, total) => {
        const speed = trackSpeed(transferred)
        sendProgress({ id: tid, filename, type: 'download', transferred, total, speed })
      })
      sendComplete(tid)
    }
  )
}
