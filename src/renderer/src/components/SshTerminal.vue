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
watch(() => settingsStore.state.settings.fontSize, (val) => {
  if (terminal) {
    terminal.options.fontSize = val
  }
  nextTick(() => fitAddon?.fit())
})

/** 初始化 xterm.js 终端（Catppuccin 配色） */
function initTerminal(): void {
  if (!terminalRef.value) return

  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: settingsStore.state.settings.fontSize,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    allowTransparency: true,
    theme: {
      background: '#1a1b26',
      foreground: '#a9b1d6',
      cursor: '#c0caf5',
      selectionBackground: '#33467c',
      black: '#32344a',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#a9b1d6',
      brightBlack: '#444b6a',
      brightRed: '#f7768e',
      brightGreen: '#9ece6a',
      brightYellow: '#e0af68',
      brightBlue: '#7aa2f7',
      brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff',
      brightWhite: '#c0caf5'
    }
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

  // 终端 resize → IPC 通知 SSH PTY (添加防抖)
  terminal.onResize(({ cols, rows }) => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      sshService.resize(props.tabId, cols, rows)
    }, 200)
  })

  // 只在可见时做初始 fit，隐藏标签等 focusAndFit 时再调
  if (terminalRef.value.offsetParent !== null) {
    fitTerminal()
  }
}

function fitTerminal(): void {
  nextTick(() => fitAddon?.fit())
}

// IPC 事件监听器引用（用于 cleanup）
let dataHandler: ((e: { id: string; data: string }) => void) | null = null
let errorHandler: ((e: { id: string; message: string }) => void) | null = null
let disconnectHandler: ((e: { id: string }) => void) | null = null

onMounted(() => {
  console.log(`[terminal] init tab=${props.tabId}`)
  initTerminal()
  window.addEventListener('click', closeMenu)

  // 注册主进程数据推送监听
  dataHandler = (e: { id: string; data: string }) => {
    if (e.id === props.tabId) {
      terminal?.write(e.data)
    }
  }

  errorHandler = (e: { id: string; message: string }) => {
    if (e.id === props.tabId) {
      console.error(`[terminal] error tab=${e.id}: ${e.message}`)
      terminal?.writeln(`\r\n\x1b[31m${t('sshTerminal.errorPrefix')}${e.message}\x1b[0m`)
      emit('error', e.message)
    }
  }

  disconnectHandler = (e: { id: string }) => {
    if (e.id === props.tabId) {
      console.log(`[terminal] disconnected tab=${e.id}`)
      terminal?.writeln(`\r\n\x1b[33m${t('sshTerminal.connectionClosed')}\x1b[0m`)
    }
  }

  window.api.onData(dataHandler)
  window.api.onError(errorHandler)
  window.api.onDisconnect(disconnectHandler)

  window.addEventListener('resize', fitTerminal)
})

onUnmounted(() => {
  // 清理：移除监听器、释放终端、清除定时器
  if (resizeTimer) clearTimeout(resizeTimer)
  window.api.removeAllListeners()
  terminal?.dispose()
  terminal = null
  window.removeEventListener('resize', fitTerminal)
  window.removeEventListener('click', closeMenu)
})

function focusAndFit(): void {
  nextTick(() => {
    fitAddon?.fit()
    terminal?.focus()
  })
}

defineExpose({ fitTerminal, terminal, focusAndFit })
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
  min-height: 0;
  background: #1a1b26;
  position: relative;
}

.context-menu {
  position: fixed;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 4px;
  padding: 4px 0;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.menu-item {
  padding: 6px 16px;
  font-size: 13px;
  color: #cdd6f4;
  cursor: pointer;
}

.menu-item:hover {
  background: #313244;
}
</style>
