# SSH FTP Hollow

OpenCode + Electron + Vue 3 + TypeScript SSH Terminal

> **语言**: 所有与用户的交流及注释均使用中文。

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Main Process                    │
│  src/main/                                      │
│    index.ts       入口：创建窗口、注册 IPC        │
│    ssh/                                         │
│      types.ts     类型定义 (SshConnectionConfig) │
│      manager.ts   SSH 引擎 Façade                │
│      shell.manager.ts  Shell 连接管理            │
│      sftp.manager.ts   SFTP 通道管理              │
│    ipc/                                          │
│      ssh.ts       SSH/SFTP IPC 通道              │
│      store.ts     持久化存储 IPC                 │
│      dialog.ts    文件对话框 IPC                 │
├─────────────────────────────────────────────────┤
│                  Preload                         │
│  src/preload/                                    │
│    index.ts      contextBridge API 暴露          │
│    index.d.ts    API 类型声明                    │
├─────────────────────────────────────────────────┤
│              Renderer Process                    │
│  src/renderer/                                   │
│    index.html       HTML 入口                    │
│    src/                                          │
│      main.ts        Vue 应用挂载                 │
│      i18n.ts        国际化                        │
│      env.d.ts       全局类型声明                 │
│      App.vue        根组件 (布局/事件分发)        │
│      stores/                                     │
│        connection.ts  tab/连接/会话面板            │
│        transfer.ts   传输队列状态                  │
│        settings.ts   用户设置                      │
│      components/                                  │
│        Sidebar.vue          左侧垂直工具栏        │
│        SessionsPanel.vue     浮动会话列表面板     │
│        ConnectionDialog.vue  连接/编辑对话框      │
│        SshSession.vue        SSH 会话生命周期     │
│        SshTerminal.vue       xterm.js 终端        │
│        FtpSession.vue         FTP 文件浏览器      │
│        TransferQueue.vue      传输队列面板        │
│        SettingsDialog.vue     设置对话框          │
│        AboutDialog.vue        关于对话框          │
│        CloseConfirmDialog.vue 关闭确认弹窗        │
│      composables/                                │
│        useAppInit.ts         应用初始化           │
│        useTabManager.ts      标签页管理           │
│        useTabPersistence.ts  tab/队列持久化       │
│        useTabDrag.ts         标签页拖拽            │
│        useTabContextMenu.ts  右键菜单              │
│        useFtpCache.ts        FTP 缓存             │
│        useWindowControls.ts  关闭确认              │
│        useZoomPreview.ts     缩放预览              │
│        useResizeOverlay.ts   窗口尺寸叠加          │
│      services/                                    │
│        sshService.ts         IPC 封装 (SSH/SFTP)  │
│        settingsService.ts    IPC 封装 (Settings)  │
│      utils/                                       │
│        deepClone.ts          深拷贝工具            │
│      assets/  (CSS/图标)                          │
│      locales/                                     │
│        zh-CN.json                                 │
│        en.json                                    │
└─────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|---|---|
| `src/main/ssh/manager.ts` | SSHManager 统一导出接口 (Façade 模式) |
| `src/main/ssh/types.ts` | `SshConnectionConfig`, `SshConnection`, 事件类型 |
| `src/main/ipc/ssh.ts` | SSH/SFTP IPC 通道 (connect/write/transfer) |
| `src/main/ipc/store.ts` | `store:get/saveConnections` / Settings |
| `src/main/ipc/dialog.ts` | `dialog:openPrivateKey` 文件选择 |
| `src/preload/index.ts` | `window.api` 上下文桥接 (含 `setZoomFactor`) |
| `src/renderer/src/stores/connection.ts` | 标签页、已保存连接、会话面板状态 |
| `src/renderer/src/stores/settings.ts` | 用户设置 (字体/缩放/UI) |
| `src/renderer/src/App.vue` | 布局、事件分发、状态路由 |
| `src/renderer/src/components/SshTerminal.vue` | xterm.js 终端 |
| `src/renderer/src/components/SshSession.vue` | 会话状态/快速命令面板/本地输入模式 |
| `src/renderer/src/components/FtpSession.vue` | SFTP 文件列表/上传下载/收藏路径操作 |
| `src/renderer/src/components/TransferQueue.vue` | 传输进度队列 (暂停/继续/取消/持久化) |
| `src/renderer/src/components/CloseConfirmDialog.vue` | 关闭确认弹窗 |
| `src/renderer/src/components/SettingsDialog.vue` | 设置对话框 (通用/显示/终端) |
| `src/renderer/src/composables/useTabManager.ts` | 标签页交互逻辑封装 |
| `src/renderer/src/services/sshService.ts` | 类型安全 IPC 服务封装 (SSH/SFTP) |
| `src/renderer/src/services/settingsService.ts` | 类型安全 IPC 服务封装 (Settings/Store) |
| `src/main/ssh/shell.manager.ts` | SSH Shell 连接管理与 IO 处理 |
| `src/main/ssh/sftp.manager.ts` | SFTP 通道管理与文件传输 |

## IPC Channels

| Channel | Direction | Payload | Description |
|---|---|---|---|
| `ssh:connect` | invoke→handle | `(id, config)` | 建立 SSH 连接 |
| `ssh:write` | send→on | `(id, data)` | 向 shell 写入输入 |
| `ssh:resize` | send→on | `(id, cols, rows)` | 调整 PTY 尺寸 |
| `ssh:disconnect` | send→on | `(id)` | 断开指定 SSH 连接 |
| `sftp:connect` | invoke→handle | `(id)` | 建立 SFTP 连接 |
| `sftp:readdir` | invoke→handle | `(id, path)` | 读取 FTP 目录 |
| `sftp:realpath` | invoke→handle | `(id, path)` | 获取远程真实路径 |
| `sftp:download` | invoke→handle | `(id, path)` | 下载文件 (弹出保存对话框) |
| `sftp:downloadDirect` | invoke→handle | `(id, path)` | 下载到默认目录 |
| `sftp:upload` | invoke→handle | `(id, remoteDir)` | 上传文件 (打开文件对话框) |
| `sftp:uploadFile` | invoke→handle | `(id, localPath, remotePath)` | 上传指定文件 |
| `sftp:dragDownload` | send→on | `(id, path)` | 拖拽下载 (fastGet → temp) |
| `transfer:progress` | send→on | `payload` | 传输进度事件 |
| `transfer:complete` | send→on | `{id, localPath}` | 传输完成 |
| `transfer:error` | send→on | `{id, error}` | 传输错误 |
| `transfer:cancelled` | send→on | `{id}` | 传输已取消 |
| `transfer:dragready` | send→on | — | 拖拽下载就绪 |
| `transfer:pause` | send→on | `(transferId)` | 暂停传输 |
| `transfer:resume` | send→on | `(transferId, tabId?, ..., connectionKey?)` | 继续传输 |
| `transfer:cancel` | send→on | `(transferId)` | 取消传输 |
| `transfer:cancelAll` | send→on | — | 取消全部传输 |
| `store:getConnections` | invoke→handle | → `SshConnection[]` | 加载连接 |
| `store:saveConnections` | invoke→handle | `(connections)` | 保存连接 |
| `store:getSettings` | invoke→handle | → `SettingsData` | 加载设置 |
| `store:saveSettings` | invoke→handle | `(data)` | 保存设置 |
| `dialog:openPrivateKey` | invoke→handle | → `{path, content}` | 选择私钥文件 |
| `dialog:exportConnections` | invoke→handle | `(jsonString)` | 导出连接到文件 |
| `dialog:importConnections` | invoke→handle | → parsed data | 从文件导入连接 |
| `dialog:openFolder` | invoke→handle | → `string\|null` | 选择文件夹 |
| `app:getVersion` | invoke→handle | → `string` | 获取应用版本 |
| `app:getVersions` | invoke→handle | → `{electron,chrome,node}` | 获取框架版本 |
| `app:getDefaultDownloadsPath` | invoke→handle | → `string` | 获取系统下载目录 |
| `window:minimize` / `:maximize` / `:unmaximize` / `:close` | invoke→handle | — | 窗口控制 |
| `window:isMaximized` | invoke→handle | → `boolean` | 窗口是否最大化 |
| `window:getPosition` / `:setPosition` | invoke→handle | → `[x,y]` / `(x,y)` | 窗口位置 |
| `shell:showItemInFolder` | invoke→handle | `(path)` | 在文件管理器中显示 |

## Dependencies

- **Electron 39** + **Vue 3.5** + **TypeScript 5.9**
- **ssh2** — SSH 连接 (纯 JS，无原生依赖)
- **@xterm/xterm** + @xterm/addon-fit + @xterm/addon-search — 终端模拟
- **uuid** — 生成 session/connection ID
- **electron-vite** — 构建工具

## Build Commands

```sh
npm run dev          # 开发模式
npm run build        # lint + typecheck + build
npm run typecheck    # tsc + vue-tsc 类型检查
npm run lint         # ESLint
```

## Store (connection.ts)

```
state (reactive)
├── tabs: Tab[]               # 打开的标签页
├── activeTabId: string|null  # 当前激活标签页 ID
├── savedConnections: SshConnection[]  # 已保存连接
└── showSessions: boolean     # 会话面板可见性

methods:
├── addTab(config, name) → Tab           # 添加标签页
├── removeTab(id)                        # 移除标签页并断开连接
├── saveConnectionByConfig(config, name)  # 自动保存/去重
├── updateConnection(id, config, name)    # 编辑保存
├── deleteConnection(id)                  # 删除连接
├── loadSavedConnections()                # 从磁盘加载
└── saveToDisk()                          # 持久化(深拷贝剥离响应式)
```

## Store (transfer.ts)

```
state (reactive)
├── items: TransferItem[]     # 传输队列 (状态: active/paused/completed/error/cancelled)
├── unseenUploads: number     # 未查看的上传项计数
├── unseenDownloads: number   # 未查看的下载项计数
├── queueOpen: boolean        # 队列是否处于打开状态
└── lastActiveTab: 'upload' | 'download'  # 上次激活的标签

methods:
├── addOrUpdate(data)                # 添加新项或更新进度 (含 unseen 计数)
├── markComplete(id) / markError(id, msg) / markCancelled(id)  # 状态标记
├── markPaused(id) / markActive(id)  # 暂停/活跃切换
├── removeItem(id)                   # 移除单条记录
├── clearCompleted()                 # 清除已完成/已取消项
├── clearUnseen()                    # 清除未查看计数
├── setQueueOpen(val)                # 设置队列打开状态
├── serializeQueue() → TransferItemData[]  # 序列化
└── restoreQueue(data[])             # 反序列化恢复 (active → paused)
```

```
SshManager
├── connect(id, config)          # 建立连接 + 打开 PTY shell
│   ├── 超时保护 (readyTimeout + 2s)
│   ├── 密码/密钥认证
│   └── 数据转发 → onData/onError/onDisconnect
├── write(id, data)              # 键盘输入
├── resize(id, cols, rows)       # PTY resize
├── disconnect(id)               # 断开连接
├── disconnectAll()              # 全部断开
├── getConnectionKey(id)         # host:port:username
├── findSessionByConnectionKey(key)  # 断线续传用匹配
├── downloadControlled(id, remote, local, tid, onProgress, startOffset?)  # 分块并行下载
├── uploadControlled(id, local, remote, tid, onProgress)    # 流式上传
├── pauseTransfer(tid)           # 暂停传输
├── resumeTransfer(tid)          # 继续传输
├── cancelTransfer(tid)          # 取消传输
└── cancelAllTransfers()         # 取消全部
```

## SFTP Manager (sftp.manager.ts)

```
下载策略:
├── downloadControlled: 分块并行 (256KB 块 × 16 并发 sftp.read)
│   ├── pause: 设标志，活跃块完成后停发新块
│   ├── resume: 清标志，重新拉取未完成块
│   └── cancel: 关 fd + handle，删 Map
├── download (非可控): fastGet 并行下载（拖拽下载用）
├── uploadControlled: createReadStream().pipe(createWriteStream)
└── upload (非可控): fastPut 并行上传
```

## Known Conventions

- IPC 调用前用 `{ ...obj }` 展开，避免 Vue 响应式代理序列化失败
- 保存到磁盘前用 `JSON.parse(JSON.stringify())` 深拷贝
- 日志前缀：`[ssh]` `[ipc]` `[preload]` `[dialog]` `[app]` `[session]` `[terminal]`
- 主题：Catppuccin Mocha (背景 `#11111b` `#1e1e2e`, 强调 `#89b4fa`)
