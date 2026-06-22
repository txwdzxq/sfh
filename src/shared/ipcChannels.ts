export const IPC = {
  // SSH
  SSH_CONNECT: 'ssh:connect',
  SSH_WRITE: 'ssh:write',
  SSH_RESIZE: 'ssh:resize',
  SSH_DISCONNECT: 'ssh:disconnect',
  SSH_DATA: 'ssh:data',
  SSH_ERROR: 'ssh:error',

  // SFTP
  SFTP_CONNECT: 'sftp:connect',
  SFTP_READDIR: 'sftp:readdir',
  SFTP_REALPATH: 'sftp:realpath',
  SFTP_DOWNLOAD: 'sftp:download',
  SFTP_DOWNLOAD_DIRECT: 'sftp:downloadDirect',
  SFTP_UPLOAD: 'sftp:upload',
  SFTP_UPLOAD_FILE: 'sftp:uploadFile',
  SFTP_DRAG_DOWNLOAD: 'sftp:dragDownload',

  // Store
  STORE_GET_CONNECTIONS: 'store:getConnections',
  STORE_SAVE_CONNECTIONS: 'store:saveConnections',
  STORE_GET_SETTINGS: 'store:getSettings',
  STORE_SAVE_SETTINGS: 'store:saveSettings',

  // Dialog
  DIALOG_OPEN_PRIVATE_KEY: 'dialog:openPrivateKey',
  DIALOG_EXPORT_CONNECTIONS: 'dialog:exportConnections',
  DIALOG_IMPORT_CONNECTIONS: 'dialog:importConnections',
  DIALOG_OPEN_FOLDER: 'dialog:openFolder',

  // App
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_VERSIONS: 'app:getVersions',
  APP_GET_DEFAULT_DOWNLOADS_PATH: 'app:getDefaultDownloadsPath',

  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_UNMAXIMIZE: 'window:unmaximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  WINDOW_GET_POSITION: 'window:getPosition',
  WINDOW_SET_POSITION: 'window:setPosition',

  // Shell
  SHELL_SHOW_ITEM: 'shell:showItemInFolder',

  // Transfer
  TRANSFER_PROGRESS: 'transfer:progress',
  TRANSFER_COMPLETE: 'transfer:complete',
  TRANSFER_ERROR: 'transfer:error',
  TRANSFER_DRAG_READY: 'transfer:dragready',
  TRANSFER_PAUSE: 'transfer:pause',
  TRANSFER_RESUME: 'transfer:resume',
  TRANSFER_CANCEL: 'transfer:cancel',
  TRANSFER_CANCEL_ALL: 'transfer:cancelAll',
  TRANSFER_CANCELLED: 'transfer:cancelled'
} as const
