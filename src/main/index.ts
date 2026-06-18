import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerSshIpc } from './ipc/ssh'
import { registerStoreIpc, loadSettingsData, saveSettings, loadSettings } from './ipc/store'
import { registerDialogIpc } from './ipc/dialog'

process.env['ELECTRON_IS_DEV'] = is.dev ? '1' : ''

let mainWindow: BrowserWindow | null = null

function createWindow(frame: boolean): void {
  const saved = loadSettingsData()
  const w = Math.max(800, Math.min(saved.windowWidth || 900, 9999))
  const h = Math.max(500, Math.min(saved.windowHeight || 670, 9999))
  mainWindow = new BrowserWindow({
    width: w,
    height: h,
    show: false,
    frame,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 窗口大小变化时保存（防抖）
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  mainWindow.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!mainWindow) return
      const [cw, ch] = mainWindow.getSize()
      const data = loadSettings()
      data.settings.windowWidth = cw
      data.settings.windowHeight = ch
      saveSettings(data)
    }, 500)
  })

  mainWindow.on('close', () => {
    if (!mainWindow) return
    const [cw, ch] = mainWindow.getSize()
    const data = loadSettings()
    data.settings.windowWidth = cw
    data.settings.windowHeight = ch
    saveSettings(data)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (is.dev) {
      mainWindow?.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerSshIpc()
  registerStoreIpc()
  registerDialogIpc()
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getVersions', () => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }))

  // 窗口控制
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('window:unmaximize', () => mainWindow?.unmaximize())
  ipcMain.handle('window:getPosition', () => mainWindow?.getPosition())
  ipcMain.handle('window:setPosition', (_e, x: number, y: number) => mainWindow?.setPosition(x, y))

  const settings = loadSettingsData()
  createWindow(settings.useSystemTitleBar ?? true)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const s = loadSettingsData()
      createWindow(s.useSystemTitleBar ?? true)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
