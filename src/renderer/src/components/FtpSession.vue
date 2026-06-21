<script setup lang="ts">
// FTP/SFTP 文件浏览器组件 — 显示远程目录、导航、下载文件

import { ref, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '../stores/connection'
import { sshService } from '../services/sshService'
import type { SftpEntry } from '../../../main/ssh/types'

const props = defineProps<{
  tabId: string
  initialPath?: string
  initialEntries?: SftpEntry[]
}>()

const emit = defineEmits<{
  loaded: [data: { path: string; entries: SftpEntry[] }]
}>()

const { tabs } = useConnectionStore()

const { t } = useI18n()

const entries = ref<SftpEntry[]>([])
const currentPath = ref('.')
const loading = ref(false)
const errorMsg = ref('')
const editing = ref(false)
const editInput = ref('')
const editRef = ref<HTMLInputElement>()
const showHidden = ref(false)
const dragOver = ref(false)
let dragCounter = 0

/** 根据 showHidden 过滤显示条目 */
const visibleEntries = computed(() =>
  showHidden.value ? entries.value : entries.value.filter((e) => !e.filename.startsWith('.'))
)

/** 面包屑导航段：{ name, path } 数组 */
const segments = computed(() => {
  if (currentPath.value === '.' || currentPath.value === '/') return []
  const parts = currentPath.value.split('/').filter(Boolean)
  const result: { name: string; path: string }[] = []
  let acc = ''
  for (const part of parts) {
    acc = acc ? acc + '/' + part : part
    result.push({ name: part, path: '/' + acc })
  }
  return result
})

/** 格式化文件大小 */
function formatSize(size: number): string {
  if (size >= 1073741824) return (size / 1073741824).toFixed(1) + ' GB'
  if (size >= 1048576) return (size / 1048576).toFixed(1) + ' MB'
  if (size >= 1024) return (size / 1024).toFixed(1) + ' KB'
  return size + ' B'
}

/** 格式化时间 */
function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

/** 加载目录内容 */
async function loadDir(path: string): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  entries.value = []
  currentPath.value = path
  try {
    // 关键逻辑：
    // 1. 如果输入是 '.', 使用 realpath 获取主目录绝对路径
    // 2. 如果输入以 '/' 开头，直接使用，无需预解析
    // 3. 其他情况，尝试拼接
    let targetPath = path
    if (path === '.') {
      targetPath = await sshService.realpath(props.tabId, '.')
    } else if (!path.startsWith('/')) {
      const currentBase =
        currentPath.value === '.' ? await sshService.realpath(props.tabId, '.') : currentPath.value
      targetPath = currentBase + '/' + path
    }

    // 更新 FTP 连接状态
    const tab = tabs.value.find((t) => t.id === props.tabId)
    if (tab) tab.ftpConnected = true

    const list = await sshService.readdir(props.tabId, targetPath)

    // 读取成功后，更新路径为服务器真正返回的绝对路径，用于面包屑显示
    currentPath.value = await sshService.realpath(props.tabId, targetPath)

    // 过滤掉 . 和 ..
    const filtered = list.filter((e) => e.filename !== '.' && e.filename !== '..')
    // 目录排前，文件排后
    filtered.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.filename.localeCompare(b.filename)
    })
    entries.value = filtered
    emit('loaded', { path: currentPath.value, entries: filtered })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = msg
    console.error(`[ftp] readdir error: ${msg}`)
    entries.value = []

    // 连接失败更新状态
    const tab = tabs.value.find((t) => t.id === props.tabId)
    if (tab) tab.ftpConnected = false
  } finally {
    loading.value = false
  }
}

/** 点击条目 */
function handleClick(entry: SftpEntry): void {
  if (entry.type === 'directory') {
    const path =
      currentPath.value === '.' ? entry.filename : currentPath.value + '/' + entry.filename
    loadDir(path)
  } else {
    handleDownload(entry.filename)
  }
}

/** 返回上级目录 */
function goUp(): void {
  const parts = currentPath.value.split('/')
  parts.pop()
  const parent = parts.join('/')
  loadDir(parent === '' ? '/' : parent)
}

/** 下载文件（弹出保存对话框） */
async function handleDownload(filename: string): Promise<void> {
  const remotePath = currentPath.value === '.' ? filename : currentPath.value + '/' + filename
  try {
    await sshService.download(props.tabId, remotePath)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = t('ftpSession.downloadFailed') + msg
  }
}

/** 上传文件 */
async function handleUpload(): Promise<void> {
  try {
    await sshService.upload(props.tabId, currentPath.value)
    loadDir(currentPath.value)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = t('ftpSession.uploadFailed') + msg
  }
}

/** 拖放上传 — 从本地拖文件到 FTP 列表 */
function onDragOver(e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
  dragCounter++
  dragOver.value = true
}

function onDragLeave(): void {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    dragOver.value = false
  }
}

function onContainerDragEnd(): void {
  dragOver.value = false
  dragCounter = 0
}

async function onDrop(e: DragEvent): Promise<void> {
  e.preventDefault()
  dragCounter = 0
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  const remoteDir = currentPath.value
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    // 获取文件的本地路径（Electron API）
    let localPath: string | undefined
    try {
      localPath = window.api.getPathForFile(file)
    } catch {
      // fallback: Electron 附加的 .path 属性
      localPath = (file as File & { path: string }).path
    }
    if (!localPath) continue
    const remotePath = (remoteDir === '.' ? '' : remoteDir) + '/' + file.name
    try {
      await sshService.uploadFile(props.tabId, localPath, remotePath)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errorMsg.value = t('ftpSession.uploadFailed', { name: file.name, msg })
    }
  }
  loadDir(remoteDir)
}

/** 拖出下载 — 拖拽文件后弹出保存对话框 */
function onDragStart(e: DragEvent, entry: SftpEntry): void {
  if (entry.type !== 'file') return
  e.dataTransfer?.setData('text/plain', entry.filename)
  e.dataTransfer!.effectAllowed = 'copy'
}

/** 拖拽结束 — 无论是否成功都弹出保存对话框 */
function onDragEnd(entry: SftpEntry): void {
  if (entry.type !== 'file') return
  handleDownload(entry.filename)
}

/** 进入路径编辑模式 */
function startEditing(e: MouseEvent): void {
  // 只有点击路径栏空白区域（而非 crumb 或 sep）时才触发编辑
  if (e.target !== e.currentTarget) return

  editInput.value = currentPath.value === '.' ? '' : currentPath.value
  editing.value = true
  nextTick(() => editRef.value?.focus())
}

/** 提交路径编辑 */
function commitEdit(): void {
  let raw = editInput.value.replace(/\\/g, '/').trim()

  // Preserve leading slash if it's an absolute path
  const isAbsolute = raw.startsWith('/')

  // Remove trailing slashes
  raw = raw.replace(/\/+$/, '')

  if (!isAbsolute) {
    // For relative paths, remove leading slashes
    raw = raw.replace(/^\/+/, '')
  }

  // If absolute and empty, it's root '/'. Otherwise use raw or default to '.'
  const sanitized = isAbsolute && raw === '' ? '/' : raw || '.'

  editing.value = false
  if (sanitized !== currentPath.value) {
    loadDir(sanitized)
  }
}

/** 取消编辑 */
function cancelEdit(): void {
  editing.value = false
}

onMounted(() => {
  if (props.initialPath && props.initialEntries && props.initialEntries.length > 0) {
    currentPath.value = props.initialPath
    entries.value = [...props.initialEntries]
  } else {
    loadDir('.')
  }
})
</script>

<template>
  <div class="ftp-container">
    <!-- 路径导航 -->
    <div class="ftp-toolbar">
      <button class="toolbar-btn" :disabled="currentPath === '.'" @click="goUp">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {{ $t('ftpSession.goUp') }}
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: showHidden }"
        :title="showHidden ? $t('ftpSession.hideDotfiles') : $t('ftpSession.showDotfiles')"
        @click="showHidden = !showHidden"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="2" />
          <path d="M22 12c0 4-4.5 8-10 8S2 16 2 12s4.5-8 10-8 10 3.5 10 8Z" />
          <line v-show="!showHidden" x1="2" y1="2" x2="22" y2="22" />
        </svg>
      </button>
      <!-- 面包屑导航 / 路径编辑 -->
      <div class="path-bar" :class="{ editing }" @click="startEditing($event)">
        <template v-if="editing">
          <input
            ref="editRef"
            v-model="editInput"
            class="path-input"
            :placeholder="$t('ftpSession.pathPlaceholder')"
            @keydown.enter="commitEdit"
            @keydown.escape="cancelEdit"
            @blur="commitEdit"
          />
        </template>
        <template v-else>
          <span
            class="crumb root"
            :class="{ active: segments.length === 0 }"
            @click="loadDir('/')"
            >{{ $t('ftpSession.rootCrumb') }}</span
          >
          <template v-for="(seg, i) in segments" :key="i">
            <span class="crumb-sep">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
            <span
              class="crumb"
              :class="{ active: i === segments.length - 1 }"
              @click="loadDir(seg.path)"
              >{{ seg.name }}</span
            >
          </template>
        </template>
      </div>
      <button class="toolbar-btn" @click="handleUpload">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {{ $t('ftpSession.upload') }}
      </button>
      <button class="toolbar-btn refresh-btn" @click="loadDir(currentPath)">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </button>
    </div>
    <!-- 状态栏 -->
    <div v-if="errorMsg" class="ftp-status error">{{ errorMsg }}</div>
    <!-- 文件列表 -->
    <div
      class="ftp-list"
      :class="{ 'drag-over': dragOver }"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @dragend="onContainerDragEnd"
    >
      <div v-if="loading && visibleEntries.length === 0" class="ftp-loading">
        <span class="spinner"></span>
        <span>{{ $t('ftpSession.loading') }}</span>
      </div>
      <div
        v-for="entry in visibleEntries"
        :key="entry.filename"
        class="ftp-item"
        :class="{ dir: entry.type === 'directory' }"
        :draggable="entry.type === 'file'"
        @click="handleClick(entry)"
        @dragstart="onDragStart($event, entry)"
        @dragend="onDragEnd(entry)"
      >
        <span class="item-icon">
          <svg
            v-if="entry.type === 'directory'"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            class="folder-icon"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            class="file-icon"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <span class="item-name">{{ entry.filename }}</span>
        <span class="item-size">{{
          entry.type === 'directory' ? '-' : formatSize(entry.size)
        }}</span>
        <span class="item-date">{{ formatTime(entry.mtime) }}</span>
      </div>
      <div v-if="visibleEntries.length === 0 && !loading && !errorMsg" class="ftp-empty">
        {{ $t('ftpSession.emptyDirectory') }}
      </div>
      <!-- 加载中覆盖层 -->
      <div v-if="loading && visibleEntries.length > 0" class="ftp-loading-overlay">
        <span class="spinner"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ftp-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 13px;
  user-select: none;
}

.ftp-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  min-height: 36px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

.toolbar-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.toolbar-btn.active {
  color: var(--accent);
  background: var(--bg-overlay);
}

.refresh-btn {
  margin-left: auto;
}

.path-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: 4px;
  overflow: hidden;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  min-width: 0;
  cursor: text;
}

.path-bar:hover {
  background: var(--bg-overlay);
}

.path-bar.editing {
  background: var(--bg-mantle);
}

.crumb {
  color: var(--text-secondary);
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}

.crumb:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.crumb.active {
  color: var(--accent);
}

.crumb.root {
  color: var(--text-muted);
}

.crumb.root.active {
  color: var(--accent);
}

.crumb-sep {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--bg-muted);
}

.path-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: inherit;
  padding: 0;
}

.ftp-status {
  padding: 6px 12px;
  font-size: 12px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.ftp-status.error {
  background: color-mix(in srgb, var(--bg-base), var(--danger) 12%);
  color: var(--danger);
}

.ftp-list {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.ftp-list.drag-over {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
  background: rgba(137, 180, 250, 0.05);
}

.ftp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--bg-mantle);
  transition: background 0.1s;
}

.ftp-item:hover {
  background: var(--bg-surface);
}

.ftp-item.dir {
  cursor: pointer;
}

.item-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.item-icon .folder-icon {
  stroke: var(--accent);
}

.item-icon .file-icon {
  stroke: var(--text-secondary);
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.ftp-item.dir .item-name {
  color: var(--accent);
}

.item-size {
  width: 80px;
  text-align: right;
  color: var(--text-muted);
  font-size: 12px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  flex-shrink: 0;
}

.item-date {
  width: 150px;
  text-align: right;
  color: var(--text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

.ftp-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
}

.ftp-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
}

.ftp-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 27, 0.7);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--bg-overlay);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
