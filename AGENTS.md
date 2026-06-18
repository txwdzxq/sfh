# SSH FTP Hollow

OpenCode + Electron + Vue 3 + TypeScript SSH Terminal

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Main Process                    │
│  src/main/                                      │
│    index.ts       入口：创建窗口、注册 IPC        │
│    ssh/                                         │
│      types.ts     类型定义 (SshConnectionConfig) │
│      manager.ts   SSH 引擎 (ssh2 连接/读写)      │
│    ipc/                                          │
│      ssh.ts       SSH IPC 通道                   │
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
│      env.d.ts       全局类型声明                 │
│      App.vue        根组件 (布局/事件分发)        │
│      stores/                                     │
│        connection.ts  全局状态管理 (tabs/session) │
│      components/                                  │
│        Sidebar.vue          左侧垂直工具栏        │
│        SessionsPanel.vue     浮动会话列表面板     │
│        ConnectionDialog.vue  连接/编辑对话框      │
│        SshSession.vue        SSH 会话生命周期     │
│        SshTerminal.vue       xterm.js 终端        │
│        SettingsDialog.vue     设置对话框 (通用/显示/终端)
│        AboutDialog.vue        关于对话框 (版本信息)
│        FtpSession.vue         FTP 文件浏览器
│        TransferQueue.vue      传输队列面板
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
| `src/renderer/src/components/FtpSession.vue` | SFTP 文件列表/上传下载操作 |
| `src/renderer/src/components/TransferQueue.vue` | 传输进度队列 |
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
| `sftp:download` | invoke→handle | `(id, path)` | 下载文件 |
| `sftp:upload` | invoke→handle | `(id, path)` | 上传文件 |
| `store:getConnections` | invoke→handle | → `SshConnection[]` | 加载连接 |
| `store:getSettings` | invoke→handle | → `AppSettings` | 加载设置 |
| `app:getVersions` | invoke→handle | → `{electron,chrome,node}` | 获取版本 |

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

## SSH Manager (manager.ts)

```
SshManager
├── connect(id, config)          # 建立连接 + 打开 PTY shell
│   ├── 超时保护 (readyTimeout + 2s)
│   ├── 密码/密钥认证
│   └── 数据转发 → onData/onError/onDisconnect
├── write(id, data)              # 键盘输入
├── resize(id, cols, rows)       # PTY resize
├── disconnect(id)               # 断开连接
└── disconnectAll()              # 全部断开
```

## Known Conventions

- IPC 调用前用 `{ ...obj }` 展开，避免 Vue 响应式代理序列化失败
- 保存到磁盘前用 `JSON.parse(JSON.stringify())` 深拷贝
- 日志前缀：`[ssh]` `[ipc]` `[preload]` `[dialog]` `[app]` `[session]` `[terminal]`
- 主题：Catppuccin Mocha (背景 `#11111b` `#1e1e2e`, 强调 `#89b4fa`)
