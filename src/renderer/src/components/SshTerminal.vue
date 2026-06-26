<script setup lang="ts">
// 终端组件 — 基于 xterm.js 的终端模拟器，处理键盘输入、输出显示、尺寸自适应

import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { sshService } from '../services/sshService'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'

function getThemeColors() {
  const s = getComputedStyle(document.documentElement)
  function v(name: string) {
    return s.getPropertyValue(name).trim()
  }
  return {
    background: v('--bg-base'),
    foreground: v('--text-primary'),
    cursor: v('--text-primary'),
    cursorAccent: v('--bg-base'),
    selectionBackground: v('--bg-hover'),
    black: v('--bg-hover'),
    red: v('--danger'),
    green: v('--success'),
    yellow: v('--warning'),
    blue: v('--accent'),
    magenta: v('--mauve'),
    cyan: v('--teal'),
    white: v('--text-sub'),
    brightBlack: v('--bg-muted'),
    brightRed: v('--danger'),
    brightGreen: v('--success'),
    brightYellow: v('--warning'),
    brightBlue: v('--accent'),
    brightMagenta: v('--mauve'),
    brightCyan: v('--teal'),
    brightWhite: v('--text-secondary')
  }
}

const props = defineProps<{
  tabId: string
}>()

const emit = defineEmits<{
  connected: []
  error: [message: string]
}>()

const terminalRef = ref<HTMLDivElement>()
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let searchAddon: SearchAddon | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null
let markConnectedTimer: ReturnType<typeof setTimeout> | null = null
let sshReady = false
let pendingSshResize: { cols: number; rows: number } | null = null
const { t } = useI18n()
const settingsStore = useSettingsStore()

// 右键菜单状态
const menuVisible = ref(false)
const menuPos = ref({ x: 0, y: 0 })

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  if (!terminal) return
  const selection = terminal.getSelection()
  if (selection) {
    menuPos.value = { x: e.clientX, y: e.clientY }
    menuVisible.value = true
  }
}

function closeMenu() {
  menuVisible.value = false
}

async function copySelection() {
  if (terminal) {
    const selection = terminal.getSelection()
    if (selection) {
      await navigator.clipboard.writeText(selection)
    }
  }
  closeMenu()
}

// 监听字体大小变化
watch(
  () => settingsStore.fontSize.value,
  (val) => {
    if (terminal) {
      terminal.options.fontSize = val
    }
    nextTick(() => fitAddon?.fit())
  }
)

// 监听主题变化
watch(
  () => settingsStore.theme.value,
  () => {
    if (terminal) {
      terminal.options.theme = getThemeColors()
    }
  }
)

/** 初始化 xterm.js 终端（Catppuccin 配色） */
function initTerminal(): void {
  if (!terminalRef.value) return

  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: settingsStore.fontSize.value,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    allowTransparency: true,
    theme: getThemeColors()
  })

  fitAddon = new FitAddon()
  searchAddon = new SearchAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(searchAddon)

  terminal.open(terminalRef.value)

  // 键盘输入 → IPC 发送到 SSH shell
  terminal.onData((data) => {
    sshService.write(props.tabId, data)
  })

  // 终端 resize → IPC 通知 SSH PTY (添加防抖，连接就绪前缓冲)
  terminal.onResize(({ cols, rows }) => {
    if (!sshReady) {
      pendingSshResize = { cols, rows }
      return
    }
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      sshService.resize(props.tabId, cols, rows)
    }, 200)
  })

  // 初始 fit 延迟到 SshSession 连接成功后调用，避免 shell 未就绪时触发 resize 导致多出 %
}

function fitTerminal(): void {
  nextTick(() => fitAddon?.fit())
}

function fitAndGetDimensions(): { cols: number; rows: number } | null {
  fitAddon?.fit()
  if (terminal) return { cols: terminal.cols, rows: terminal.rows }
  return null
}

const cleanups: (() => void)[] = []

onMounted(() => {
  console.log(`[terminal] init tab=${props.tabId}`)
  initTerminal()
  window.addEventListener('click', closeMenu)

  // 注册主进程数据推送监听（返回清理函数）
  cleanups.push(
    window.api.onData((e: { id: string; data: string }) => {
      if (e.id === props.tabId) {
        terminal?.write(e.data)
      }
    })
  )

  cleanups.push(
    window.api.onError((e: { id: string; message: string }) => {
      if (e.id === props.tabId) {
        console.error(`[terminal] error tab=${e.id}: ${e.message}`)
        terminal?.writeln(`\r\n\x1b[31m${t('sshTerminal.errorPrefix')}${e.message}\x1b[0m`)
        emit('error', e.message)
      }
    })
  )

  cleanups.push(
    window.api.onDisconnect((e: { id: string }) => {
      if (e.id === props.tabId) {
        console.log(`[terminal] disconnected tab=${e.id}`)
        terminal?.writeln(`\r\n\x1b[33m${t('sshTerminal.connectionClosed')}\x1b[0m`)
      }
    })
  )

  window.addEventListener('resize', fitTerminal)
})

onUnmounted(() => {
  if (resizeTimer) clearTimeout(resizeTimer)
  if (markConnectedTimer) clearTimeout(markConnectedTimer)
  cleanups.forEach((fn) => fn())
  terminal?.dispose()
  terminal = null
  window.removeEventListener('resize', fitTerminal)
  window.removeEventListener('click', closeMenu)
})

function focusAndFit(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void terminalRef.value?.offsetHeight
      fitAddon?.fit()
      terminal?.focus()
    })
  })
}

function markConnected(): void {
  fitTerminal()
  markConnectedTimer = setTimeout(() => {
    sshReady = true
    if (pendingSshResize) {
      sshService.resize(props.tabId, pendingSshResize.cols, pendingSshResize.rows)
      pendingSshResize = null
    }
  }, 500)
}

defineExpose({ fitTerminal, terminal, focusAndFit, markConnected, fitAndGetDimensions })
</script>

<template>
  <div ref="terminalRef" class="terminal-container" @contextmenu.prevent="onContextMenu">
    <!-- 上下文菜单 -->
    <div
      v-show="menuVisible"
      class="context-menu"
      :style="{ top: `${menuPos.y}px`, left: `${menuPos.x}px` }"
    >
      <div class="menu-item" @click="copySelection">{{ $t('sshTerminal.menu.copy') }}</div>
    </div>
  </div>
</template>

<style scoped>
.terminal-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-base);
  position: relative;
  padding: 5px;
}

.context-menu {
  position: fixed;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 0;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.menu-item {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}

.menu-item:hover {
  background: var(--bg-overlay);
}
</style>
