// 文件对话框 IPC 处理器 — 打开系统文件选择器并读写文件

import { ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync, statSync } from 'fs'
import { IPC } from '../../shared/ipcChannels'

const MAX_KEY_FILE_SIZE = 1024 * 1024 // 1MB
const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function registerDialogIpc(): void {
  ipcMain.handle(IPC.DIALOG_OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.DIALOG_OPEN_PRIVATE_KEY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Private Keys', extensions: ['pem', 'key', 'ppk', 'id_rsa', 'id_ed25519', '*'] }
      ]
    })
    if (result.canceled) return null
    const filePath = result.filePaths[0]
    const stat = statSync(filePath)
    if (stat.size > MAX_KEY_FILE_SIZE) throw new Error('Key file too large')
    const content = readFileSync(filePath, 'utf-8')
    return { path: filePath, content }
  })

  ipcMain.handle(IPC.DIALOG_EXPORT_CONNECTIONS, async (_event, data: string) => {
    if (typeof data !== 'string') throw new Error('Invalid data')
    if (data.length > MAX_IMPORT_FILE_SIZE) throw new Error('Data too large')
    const result = await dialog.showSaveDialog({
      defaultPath: 'ssh-connections.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    writeFileSync(result.filePath, data, 'utf-8')
    return true
  })

  ipcMain.handle(IPC.DIALOG_IMPORT_CONNECTIONS, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled) return null
    const filePath = result.filePaths[0]
    const stat = statSync(filePath)
    if (stat.size > MAX_IMPORT_FILE_SIZE) throw new Error('Import file too large')
    const content = readFileSync(filePath, 'utf-8')
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  })
}
