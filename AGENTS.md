# SSH FTP Hollow

OpenCode + Electron + Vue 3 + TypeScript SSH Terminal

> **语言**: 所有与用户的交流及注释均使用中文。**必须**使用中文回复用户，不得使用英文（除代码、变量名、文件路径、技术术语外）。如果之前用英文回复了，立即纠正为中文。

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
│        TabBar.vue             标签栏(统一 frameless/system) │
│        TabContextMenu.vue     标签页右键菜单       │
│        LocalInputBar.vue      本地输入栏+快捷命令  │
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
│        throttle.ts           节流工具              │
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
| `src/main/index.ts` | 主入口：创建窗口、注册 IPC、窗口状态持久化（尺寸/位置/最大化） |
| `src/main/ipc/store.ts` | 持久化存储 IPC (Connections / Settings / 窗口状态) |
| `src/main/ipc/dialog.ts` | `dialog:openPrivateKey` 文件选择 |
| `src/preload/index.ts` | `window.api` 上下文桥接 (含 `setZoomFactor`, `setWindowOpacity`) |
| `src/renderer/src/stores/connection.ts` | 标签页、已保存连接、会话面板状态 |
| `src/renderer/src/stores/settings.ts` | 用户设置 (字体/缩放/UI/窗口状态) |
| `src/renderer/src/App.vue` | 布局、事件分发、状态路由 |
| `src/renderer/src/components/TabBar.vue` | 标签栏（统一 frameless/system 模式） |
| `src/renderer/src/components/TabContextMenu.vue` | 标签页右键菜单 |
| `src/renderer/src/components/LocalInputBar.vue` | 本地输入栏+快捷命令面板 |
| `src/renderer/src/components/SshTerminal.vue` | xterm.js 终端 |
| `src/renderer/src/components/SshSession.vue` | 会话状态/连接生命周期 |
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
| `window:setOpacity` | invoke→handle | `(factor)` | 设置窗口透明度 (0-1, 内部映射 0.8-1.0) |
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
│   └── 完成: progressTimer 清空后调用 onProgress(total, total) 确保 100%
├── downloadStreamed: ParallelReadStream → pipe(fs.createWriteStream)
│   └── 完成: onProgress(total, total) 在 writeStream.finish 中调用
├── download (非可控): fastGet 并行下载（拖拽下载用）
├── uploadControlled: createReadStream().pipe(sftp.createWriteStream)
│   ├── 进度: readStream.on('data') 节流 200ms，finish/close 双事件监听
│   └── 完成: settled 标志防重复，onProgress(total, total) 在 finish/close 中调用
└── upload (非可控): fastPut 并行上传
```

## Known Conventions

- IPC 调用前用 `{ ...obj }` 展开，避免 Vue 响应式代理序列化失败
- 保存到磁盘前用 `JSON.parse(JSON.stringify())` 深拷贝
- 日志前缀：`[ssh]` `[ipc]` `[preload]` `[dialog]` `[app]` `[session]` `[terminal]`
- 主题：Catppuccin Mocha (背景 `#11111b` `#1e1e2e`, 强调 `#89b4fa`)
- 窗口状态（尺寸/位置/最大化）在 `close` 事件中保存到 `settings.json`，`resize` 防抖 500ms 只保存正常（非最大化）尺寸
- **不允许在 `beforeunload` 中写窗口状态**：渲染器 `beforeunload` 中的 `persistFn()` 无 await，IPC invoke 排队在主进程，`close` 处理器先保存正确数据后被排队 IPC 覆盖
- **Flex 高度约束链**：`.app` → `.app-body(min-height:0)` → `.main-area(min-height:0)` → `.main-vertical(min-height:0)` → `.content(min-height:0, overflow:hidden, display:flex, flex-direction:column)` → `.session-wrapper(min-height:0, display:flex, flex-direction:column)` → `.session-container(min-height:0, display:flex, flex-direction:column)` → `.terminal-container(min-height:0)`，任何一层缺少 `min-height: 0` 或 `display: flex` 都会导致窗口缩小时底部输入栏被挤出可视区域或终端内容被裁剪
- **传输完成进度确保**：所有传输方法（`uploadControlled`、`downloadControlled`、`downloadStreamed`）在 resolve 前必须调用 `onProgress(total, total)` 确保 100% 进度。IPS 层的 `sendComplete` 捕获最后的 `lastTransferred`/`lastTotal` 传递给渲染进程。Renderer store 的 `markComplete` 强制 `transferred = total`，确保 UI 始终显示 100%。
- **SFTP WriteStream 事件选择**：`ssh2` 的 `sftp.createWriteStream()` 可能不发射 `finish` 事件，必须同时监听 `finish` 和 `close` 两个事件，使用 `settled` 标志防止重复 resolve。
- **进度节流**：`uploadControlled` 内部使用 200ms 节流（`throttledProgress`）控制 `onProgress` 回调频率，避免 IPC 消息风暴。渲染进程的 `addOrUpdate` 不再使用额外节流，直接更新 store。
- **addOrUpdate 阻止 completed/cancelled 更新**：防止节流延迟到达的旧进度值覆盖 `markComplete` 已设好的正确值。如果需要在完成后允许更新，须确保只接受非递减的 `transferred` 值。
- **Vue 模板多行表达式**：Vue 模板事件处理器中使用多行表达式时，语句之间需要 `;` 分隔（如 `stmt1; stmt2`），否则 Vue 编译器报 `Unexpected token, expected ","`。推荐用逗号表达式 `(a, b)` 单行写法，不会被 Prettier 重新格式化。
- **SSH resize 宽限期**：`SshTerminal.vue` 不使用 `ResizeObserver`（避免每次终端内容变化触发 `fitAddon.fit()` → SSH resize 导致 zsh PROMPT_EOL_MARK `%` 多出）。窗口 resize 由 `window.addEventListener('resize')` 覆盖，布局变化由 `App.vue` 的 `ResizeObserver` on `mainVerticalRef` 覆盖。连接建立后 `markConnected()` 启动 500ms 宽限期，期间 `terminal.onResize` 仅缓冲不发送，宽限期结束后发送缓冲的 resize
- **组件拆分原则**：App.vue 仅保留布局骨架 + 状态管理 + 事件分发；自包含的 UI 区域（标签栏、输入栏、右键菜单）拆为独立 `.vue` 组件，script + template + style 一起移出；子组件通过 props 接收数据、通过 emits 向上传递事件
- **窗口透明度映射**：滑块值 `0-100` 通过 `windowOpacity = 0.8 + sliderFactor × 0.2` 映射到 Electron 的 `setOpacity(0.8-1.0)`。滑块 0% → 窗口 80% 透明度，滑块 100% → 窗口 100% 透明度。映射只在 `main/index.ts` 的 IPC handler 和启动代码中进行，store 中存储原始滑块值 (0-100)。
