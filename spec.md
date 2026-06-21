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
- Import / export connections as JSON file
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
- Context menu: Copy (right-click on selection)

### 3.3 Status Indication
- Connecting: spinner + message
- Connected: terminal visible, input bar shown
- Error: error message displayed, terminal hidden
- Disconnected: closure message

## 4. Local Input Mode

### 4.1 Input Bar
- Textarea below terminal, visible when connected
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

### 5.2 File Operations
- Upload: drag files from system into FTP panel
- Download: drag files from FTP panel out (sets `effectAllowed: copy`)
- Upload progress: per-file progress via `sftp.fastPut` step callback
- Download progress: per-file progress via `sftp.fastGet` step callback
- Transfer queue panel: uploads/downloads tabs, progress bars, speed display

### 5.3 Cache
- FTP cache keyed by tab ID, stored in App.vue
- Prevents re-fetch on sub-tab switch
- Cleared on tab close or reconnect
- Auto-FTP option: connect SFTP + pre-load directory when SSH connects

## 6. Window & UI

### 6.1 Titlebar
- Custom frameless titlebar (default):
  - Logo + tabs in unified bar
  - `-webkit-app-region: drag` on titlebar → native OS window snap
  - Minimize / Maximize / Close buttons with IPC
- System titlebar option (Settings, restart required)

### 6.2 Window State
- Window size saved on resize (debounced 500ms) and on close
- Window size restored on startup (min 800×500)
- Resize overlay: centered `W × H` shown briefly on resize, fades after 500ms

### 6.3 Sidebar
- Vertical toolbar with icon buttons:
  - New connection
  - Sessions panel toggle
  - Transfer queue toggle
  - Settings
  - About

### 6.4 Sessions Panel
- Floating panel with saved connection list
- Export (⤊) / Import (⤋) buttons in header
- Drag-and-drop reorder with blue top/bottom border indicator
- Edit (pencil) / Delete (×) per session

### 6.5 Transfer Queue
- Floating panel with Uploads / Downloads sub-tabs
- Each item: filename, progress bar, speed, status (active/completed/error)
- Clear completed button

## 7. Settings

### 7.1 General Tab
- Reopen tabs on startup (toggle)
- Auto-connect SFTP on SSH connect (toggle)
- Use system titlebar (toggle, restart required)
- Language: 中文 / English (runtime switch, no restart)

### 7.2 Display Tab
- Zoom (slider 1.0-3.0, step 0.1, apply on release)

### 7.3 Terminal Tab
- Font size (slider 8-32, instant update)

## 8. Internationalization

- Runtime language switch via `vue-i18n` (no restart)
- Supported: zh-CN, en
- ~100+ keys covering all UI labels and messages
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
- `settings.json` — settings + saved tab list
