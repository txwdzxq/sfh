// 文件对话框 IPC 处理器 — 打开系统文件选择器并读写文件

import { ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'

export function registerDialogIpc(): void {
  ipcMain.handle('dialog:openPrivateKey', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Private Keys', extensions: ['pem', 'key', 'ppk', 'id_rsa', 'id_ed25519', '*'] }
      ]
    })
    if (result.canceled) return null
    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8')
    return { path: filePath, content }
  })

  ipcMain.handle('dialog:exportConnections', async (_event, data: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'ssh-connections.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    writeFileSync(result.filePath, data, 'utf-8')
    return true
  })

  ipcMain.handle('dialog:importConnections', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled) return null
    const content = readFileSync(result.filePaths[0], 'utf-8')
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  })
}
