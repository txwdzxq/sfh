import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../build/icon.png?asset'
import { IPC } from '../shared/ipcChannels'
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
    x: saved.windowX ?? undefined,
    y: saved.windowY ?? undefined,
    show: false,
    frame,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (saved.windowMaximized) {
    mainWindow.maximize()
  }

  const rawFactor = (saved.opacity ?? 100) / 100
  mainWindow.setOpacity(0.8 + Math.max(0, Math.min(1, rawFactor)) * 0.2)

  // 窗口大小变化时保存正常（非最大化）尺寸（防抖）
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  mainWindow.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isMaximized()) return
      const [cw, ch] = mainWindow.getSize()
      const data = loadSettings()
      data.settings.windowWidth = cw
      data.settings.windowHeight = ch
      saveSettings(data)
    }, 500)
  })

  mainWindow.on('close', () => {
    // 清除 resize 防抖，避免其异步回调覆盖刚保存的数据
    if (resizeTimer) {
      clearTimeout(resizeTimer)
      resizeTimer = null
    }
    if (!mainWindow) return
    const maximized = mainWindow.isMaximized()
    const data = loadSettings()
    data.settings.windowMaximized = maximized
    if (maximized) {
      data.settings.windowX = null
      data.settings.windowY = null
    } else {
      const [cw, ch] = mainWindow.getSize()
      const [x, y] = mainWindow.getPosition()
      data.settings.windowWidth = cw
      data.settings.windowHeight = ch
      data.settings.windowX = x
      data.settings.windowY = y
    }
    saveSettings(data)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
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
  electronApp.setAppUserModelId('com.sfh.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerSshIpc()
  registerStoreIpc()
  registerDialogIpc()
  ipcMain.handle(IPC.APP_GET_DEFAULT_DOWNLOADS_PATH, () => app.getPath('downloads'))
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())
  ipcMain.handle(IPC.APP_GET_VERSIONS, () => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }))

  // 窗口控制
  ipcMain.handle(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize())
  ipcMain.handle(IPC.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle(IPC.WINDOW_CLOSE, () => mainWindow?.close())
  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle(IPC.WINDOW_UNMAXIMIZE, () => mainWindow?.unmaximize())
  ipcMain.handle(IPC.WINDOW_GET_POSITION, () => mainWindow?.getPosition())
  ipcMain.handle(IPC.WINDOW_SET_POSITION, (_e, x: number, y: number) =>
    mainWindow?.setPosition(x, y)
  )
  ipcMain.handle(IPC.WINDOW_SET_OPACITY, (_e, factor: number) => {
    mainWindow?.setOpacity(0.8 + Math.max(0, Math.min(1, factor)) * 0.2)
  })

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
