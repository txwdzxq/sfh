# SFH — Product Feature Specification

## 1. Connection Management

### 1.1 New Connection
- Dialog with fields: name, host, port (1-65535), username, password / private key
- Auth methods: password or private key (file browse or paste content)
- Connection name auto-filled as `user@host:port` when left empty
- "Exec command" field: command sent to shell immediately after PTY opens

### 1.2 Session Persistence
- Connections saved automatically after first successful connect
- Deduplication key: `host + port + username` (updates existing on match)
- Saved connections list shown in Sessions Panel (floating panel activated from sidebar)
- Edit / delete saved connections
- Import / export connections as JSON file (SVG icons in panel header)
- Drag-and-drop to reorder saved connection list

### 1.3 Connection Lifecycle
- TCP connection with 30s keepalive interval, 3 retries before disconnect
- On SSH connect: open PTY shell, optionally write exec command
- On disconnect: cleanup shell + client, notify renderer
- Reconnect button on each session tab (sequential: SSH → SFTP → reload FTP)
- Tab connection status indicated by tab name color + title tooltip

## 2. Tabs

### 2.1 Multi-Tab Sessions
- Each tab holds one SSH connection with SSH terminal + FTP sub-tabs
- Tab naming: user-defined or fallback to `user@host:port`
- Middle-click to close tab
- Mouse wheel to switch between tabs
- Drag-and-drop to reorder tabs (blue left-border indicator)
- Right-click context menu: Reload (disconnect + reconnect)

### 2.2 Tab Persistence
- "Reopen tabs on startup" option (settings)
- Tab list saved on every add/close/drag — not on every connection status change
- Tabs restored on startup: each creates new SSH connection with saved config

### 2.3 Close Confirmation
- When closing window with active transfers, a confirmation dialog appears
- Dialog lists transfer count, Cancel (stays open) / Close (cancels transfers & quits)
- Before close: `cancelAllTransfers()` → persist tabs + transfers to disk

## 3. Terminal

### 3.1 xterm.js Integration
- Catppuccin Mocha color theme
- Font family: Cascadia Code / Fira Code / Consolas
- Font size: 8-32 (slider in Settings, instant update)
- Zoom: 1.0-3.0 (step 0.1, slider in Settings, apply on release)
  - During drag: CSS `transform: scale()` preview with `top left` origin
  - On apply: `webFrame.setZoomFactor()` persisted to settings
- Fit addon: auto-resize terminal to container on init and on window resize (debounced 200ms)
- Search addon available

### 3.2 Terminal I/O
- Keyboard input → IPC → SSH shell write
- Shell output → IPC → terminal write
- Terminal resize → IPC → PTY resize (debounced 200ms)
- SSH resize grace period: 500ms after connection, resize buffered (not sent) to avoid zsh PROMPT_EOL_MARK `%` artifacts
- Context menu: Copy (right-click on selection)

### 3.3 Status Indication
- Connecting: spinner + message
- Connected: terminal visible, input bar shown
- Error: error message displayed, terminal hidden
- Disconnected: closure message

## 4. Local Input Mode

### 4.1 Input Bar
- Textarea below terminal, visible when connected (component: `LocalInputBar.vue`)
- Enter sends command, Shift+Enter for newline
- ↑↓ navigate command history (per-session, max 500 entries)
- Auto-expanding textarea (max 200px, then scroll)

### 4.2 Quick Commands
- Panel expands upward from input bar (⚡ button)
- Pre-populated defaults: `ps -ef`, `top`, `df -h`, `who`
- Click: fill input bar; Shift+click: send directly
- Add custom commands via input field at bottom of panel
- Remove commands with × button
- Persisted per-app via localStorage (shared across sessions)

## 5. FTP File Browser

### 5.1 Directory Listing
- SFTP channel opened on existing SSH connection
- Breadcrumb navigation with clickable path segments
- Inline path editing (click to edit, Enter to confirm)
- Toggle hidden files (.dotfiles)
- Sort: directories first, then alphabetical by filename
- Current path shown in address bar with selectable segments

### 5.2 File Operations
- Upload: click upload button → native file dialog → per-file streamed upload
- Download: click file → save dialog → chunked parallel download (256KB × 16 concurrent)
- Drag to download: drag files from FTP panel out → `fastGet` to temp → native drag event
- Upload progress: per-file via `createReadStream().pipe(sftp.createWriteStream())`
- Download progress: per-file via chunked `sftp.read` callbacks (16 parallel reads)
- Pause/Resume: set flag stops new chunks; resume re-starts pending chunks
- Cancel: destroy all streams + close fd/handle; status shown as "cancelled" (grey)
- Cancel does NOT delete partially downloaded file

### 5.3 Path Bookmarks
- ★ button inside address bar: toggle bookmark on current path
- ✪ button outside address bar: opens dropdown menu of saved bookmarks
- Click bookmark in dropdown → navigate to that path
- Delete bookmark from dropdown
- Bookmarks stored in `{userData}/config/settings.json` under `ftpBookmarks` key
- Shared globally across all connections (not per-connection)

### 5.4 Cache
- FTP cache keyed by tab ID, stored in App.vue
- Prevents re-fetch on sub-tab switch
- Cleared on tab close or reconnect
- Auto-FTP option: connect SFTP + pre-load directory when SSH connects

## 6. Window & UI

### 6.1 Titlebar
- Custom frameless titlebar (default, component: `TabBar.vue`):
  - Logo + tabs in unified bar
  - `-webkit-app-region: drag` on titlebar → native OS window snap
  - Minimize / Maximize / Close buttons with IPC
- System titlebar option (Settings, restart required)
- Right-click context menu on tabs (component: `TabContextMenu.vue`): Reload, Close Left/Right, Close All

### 6.2 Window State
- Window size saved on resize (debounced 500ms, only normal/unmaximized size)
- Window position and maximized state saved on close (not on resize to avoid churn)
- Window state restored on startup: normal size, position, and maximized flag
- Normal (unmaximized) size preserved across sessions even if window was closed while maximized
- Race condition guard: `close` handler clears resize debounce timer to prevent stale overlay; `closed` event sets `mainWindow = null`
- **No `beforeunload` persistence**: window state writes exclusively from main process to avoid renderer IPC queue overwriting correct data
- Resize overlay: centered `W × H` shown briefly on resize, fades after 500ms
- **Flex 高度约束链**：`.main-area` 和 `.main-vertical` 必须设置 `min-height: 0`；`.content` 和 `.session-wrapper` 必须设置 `display: flex; flex-direction: column; min-height: 0`，否则窗口缩小时终端内容会被 `overflow: hidden` 裁剪且不产生滚动条

### 6.3 Sidebar
- Vertical toolbar with icon buttons:
  - New connection
  - Sessions panel toggle
  - Transfer queue toggle (badge: unseen upload/download counts)
  - Settings
  - About

### 6.4 Sessions Panel
- Floating panel with saved connection list
- Export / Import buttons in header (SVG icons)
- Drag-and-drop reorder with blue top/bottom border indicator
- Edit (pencil) / Delete (×) per session

### 6.5 Transfer Queue
- Floating panel with Uploads / Downloads sub-tabs
- Per-item buttons:
  - active: ⏸ Pause, ✕ Cancel
  - paused: ▶ Resume, ✕ Cancel
  - completed: 📁 Open folder (downloads only)
  - error: ↻ Retry (downloads with tabId+remotePath), ✕ Remove
  - cancelled: ↻ Retry (downloads with tabId+remotePath), ✕ Remove
- Each item: filename, progress bar, transferred/total, speed (active only), status label
- Status labels: active (progress%), paused (yellow), error (red), done (dim), cancelled (grey)
- Clear completed button (removes completed + cancelled + error items)
- Queue state persisted on window close: active items saved as "paused"
- Queue restored on startup: active → paused; download can resume if SSH session reconnects
- Connection matching for resume: `connectionKey` = `host:port:username`
- Last active sub-tab (uploads/downloads) remembered across sessions
- Unseen count: increment when queue closed and new item added

#### 6.5.1 Download Engine
- Chunked parallel download (default: 256KB chunks, 16 concurrent reads)
- Uses raw `sftp.read(handle, buf, 0, len, offset, cb)` → `fs.write(fd, buf, 0, bytes, offset, cb)`
- Download speed on par with `fastGet` (~4 MB/s on typical connections)
- Resume: skip already-downloaded chunks via `startOffset`, open local file in `r+` mode
- Pause: set flag, active chunks finish, no new chunks dispatched
- Resume: clear flag, re-enter chunk dispatch loop for pending chunks
- Cancel: set flag, close fd + handle, delete from transfer map
- **100% progress guarantee**: `onProgress(total, total)` called before `resolve()` in `downloadControlled` and `downloadStreamed` to ensure final progress event reaches 100% regardless of throttling state

#### 6.5.2 Upload Engine
- Streamed upload: `fs.createReadStream().pipe(sftp.createWriteStream())`
- Progress throttled at 200ms intervals via `throttledProgress` to reduce IPC message frequency
- **100% progress guarantee**: `onProgress(total, total)` called before `resolve()` to ensure final progress reaches 100%
- **WriteStream event**: must listen for both `finish` and `close` events (SSH2's `sftp.createWriteStream()` may not emit `finish`); uses `settled` flag to prevent duplicate resolve
- Pause: `readStream.pause()` + flag
- Resume: `readStream.resume()` + clear flag
- Cancel: `readStream.destroy()` + `writeStream.destroy()` + close handle

## 7. Settings

### 7.1 General Tab
- Reopen tabs on startup (toggle)
- Auto-connect SFTP on SSH connect (toggle)
- Use system titlebar (toggle, restart required)
- Language: 中文 / English (runtime switch, no restart)

### 7.2 Display Tab
- Zoom (slider 1.0-3.0, step 0.1, apply on release)
- Window opacity (slider 0-100, step 1, instant apply via IPC)
  - Remap: `windowOpacity = 0.8 + sliderFactor × 0.2` (10%-100% window opacity)
  - Persisted on release, restored on startup

### 7.3 Terminal Tab
- Font size (slider 8-32, instant update)

### 7.4 Transfer Tab
- Default download path: path selector with reset-to-default button
- Ask for save location before downloading (toggle)
- Show queue when downloading (toggle; auto-switches to Downloads tab)

## 8. Internationalization

- Runtime language switch via `vue-i18n` (no restart)
- Supported: zh-CN, en
- 150+ keys covering all UI labels and messages
- Fallback locale: en

## 9. Security

- Credentials encrypted at rest via Electron `safeStorage.encryptString()`
- Encrypted data written to `{userData}/config/connections.json`
- Fallback to plaintext with console warning when encryption unavailable
- Private key passphrase: not stored; prompted at connection time

## 10. About Dialog

- App name + version
- Electron / Chrome / Node versions
- GitHub repository link (inline SVG icon)

## 11. Data Storage Paths

| Platform | Config Directory |
|---|---|
| Windows | `%APPDATA%\sfh\config\` |
| macOS | `~/Library/Application Support/sfh/config/` |
| Linux | `~/.config/sfh/config/` |

Files:
- `connections.json` — encrypted saved connections
- `settings.json` — settings + saved tab list + transfer queue + FTP bookmarks
