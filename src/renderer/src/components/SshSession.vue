<script setup lang="ts">
// SSH 会话组件 — 管理连接生命周期：连接中 / 已连接 / 已断开 / 错误

import { onMounted, onUnmounted, ref } from 'vue'
import { useConnectionStore } from '../stores/connection'
import SshTerminal from './SshTerminal.vue'
import type { SshConnectionConfig } from '../../../main/ssh/types'

const props = defineProps<{
  tabId: string
  config: SshConnectionConfig
}>()

const emit = defineEmits<{
  connected: []
  error: [message: string]
}>()

const status = ref<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
const errorMsg = ref('')
const terminalRef = ref<InstanceType<typeof SshTerminal>>()
const { tabs } = useConnectionStore()

/** 本地输入模式 */
const localInput = ref('')
const inputHistory = ref<string[]>([])
const historyIndex = ref(-1)
const inputRef = ref<HTMLTextAreaElement>()

function autoResizeInput(): void {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

/** 快捷命令 */
const showQuickCommands = ref(false)
const newCommand = ref('')
const QC_KEY = 'ssh-quick-commands'
const quickCommands = ref<string[]>(loadQuickCommands())

function loadQuickCommands(): string[] {
  try {
    const raw = localStorage.getItem(QC_KEY)
    return raw ? JSON.parse(raw) : ['ps -ef', 'top', 'df -h', 'who']
  } catch {
    return ['ps -ef', 'top', 'df -h', 'who']
  }
}

function saveQuickCommands(): void {
  localStorage.setItem(QC_KEY, JSON.stringify(quickCommands.value))
}

function addCommand(): void {
  const cmd = newCommand.value.trim()
  if (!cmd) return
  quickCommands.value.push(cmd)
  saveQuickCommands()
  newCommand.value = ''
}

function removeCommand(index: number): void {
  quickCommands.value.splice(index, 1)
  saveQuickCommands()
}

function selectCommand(cmd: string, e?: MouseEvent): void {
  if (e?.shiftKey) {
    window.api.write(props.tabId, cmd + '\n')
  } else {
    localInput.value = cmd
  }
  showQuickCommands.value = false
}

function sendCommand(cmd: string): void {
  window.api.write(props.tabId, cmd + '\n')
  showQuickCommands.value = false
}

function sendLocalInput(): void {
  const text = localInput.value
  if (!text) return
  window.api.write(props.tabId, text + '\n')
  if (inputHistory.value[inputHistory.value.length - 1] !== text) {
    inputHistory.value.push(text)
    if (inputHistory.value.length > 500) inputHistory.value.shift()
  }
  historyIndex.value = -1
  localInput.value = ''
}

function handleInputKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendLocalInput()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (inputHistory.value.length === 0) return
    const newIdx =
      historyIndex.value === -1
        ? inputHistory.value.length - 1
        : Math.max(0, historyIndex.value - 1)
    historyIndex.value = newIdx
    localInput.value = inputHistory.value[newIdx]
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (historyIndex.value === -1) return
    const newIdx = historyIndex.value + 1
    if (newIdx >= inputHistory.value.length) {
      historyIndex.value = -1
      localInput.value = ''
    } else {
      historyIndex.value = newIdx
      localInput.value = inputHistory.value[newIdx]
    }
    return
  }
}

function focusAndFit(): void {
  terminalRef.value?.focusAndFit()
}

defineExpose({ focusAndFit })

onMounted(async () => {
  console.log(
    `[session] connecting tab=${props.tabId} ${props.config.username}@${props.config.host}:${props.config.port}`
  )
  try {
    await window.api.connect(props.tabId, { ...props.config })
    console.log(`[session] connected tab=${props.tabId}`)
    status.value = 'connected'
    emit('connected')

    const tab = tabs.value.find((t) => t.id === props.tabId)
    if (tab) tab.connected = true
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[session] error tab=${props.tabId}: ${message}`)
    status.value = 'error'
    errorMsg.value = message
    emit('error', message)
  }
})

onUnmounted(() => {
  window.api.disconnect(props.tabId)
})
</script>

<template>
  <div class="session-container">
    <div v-if="status === 'connecting'" class="status-bar">
      <span class="spinner"></span>
      {{ $t('sshSession.connecting', { host: config.host, port: config.port }) }}
    </div>
    <div v-if="status === 'error'" class="status-bar error">
      {{ $t('sshSession.connectionFailed', { msg: errorMsg }) }}
    </div>
    <div v-if="status === 'disconnected'" class="status-bar disconnected">
      {{ $t('sshSession.connectionClosed') }}
    </div>
    <SshTerminal
      v-if="status !== 'error'"
      ref="terminalRef"
      :tab-id="tabId"
      @connected="emit('connected')"
      @error="
        (msg) => {
          status = 'error'
          errorMsg = msg
          emit('error', msg)
        }
      "
    />
    <!-- 本地输入模式 -->
    <div v-if="status === 'connected'" class="input-bar-wrapper">
      <div v-if="showQuickCommands" class="quick-commands-panel">
        <div v-for="(cmd, i) in quickCommands" :key="i" class="quick-item">
          <span class="quick-cmd" @click="selectCommand(cmd, $event)">{{ cmd }}</span>
          <button
            class="quick-send-btn"
            :title="$t('sshSession.quickCommand.send')"
            @click="sendCommand(cmd)"
          >
            ▶
          </button>
          <button
            class="quick-del"
            :title="$t('sshSession.quickCommand.remove')"
            @click="removeCommand(i)"
          >
            ×
          </button>
        </div>
        <div class="quick-add">
          <input
            v-model="newCommand"
            class="quick-add-input"
            :placeholder="$t('sshSession.quickCommand.addPlaceholder')"
            @keydown.enter="addCommand"
          />
        </div>
      </div>
      <div class="local-input-bar">
        <button
          class="quick-btn"
          :class="{ active: showQuickCommands }"
          :title="$t('sshSession.quickCommand.toggle')"
          @click="showQuickCommands = !showQuickCommands"
        >
          ⚡
        </button>
        <textarea
          ref="inputRef"
          v-model="localInput"
          class="local-input"
          rows="1"
          :placeholder="$t('sshSession.localInput.placeholder')"
          @keydown="handleInputKeydown"
          @input="autoResizeInput"
        ></textarea>
        <button class="send-btn" :title="$t('sshSession.localInput.send')" @click="sendLocalInput">
          ⏎
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.status-bar {
  padding: 6px 12px;
  font-size: 12px;
  background: #1e1e2e;
  color: #a6adc8;
  border-bottom: 1px solid #313244;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-bar.error {
  background: #2a1b1b;
  color: #f38ba8;
}

.status-bar.disconnected {
  background: #1e1e2e;
  color: #6c7086;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #313244;
  border-top: 2px solid #89b4fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.local-input-bar {
  display: flex;
  flex-shrink: 0;
  min-height: 36px;
  border-top: 1px solid #313244;
  background: #1e1e2e;
  align-items: flex-end;
}

.local-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #cdd6f4;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  padding: 8px 12px;
  resize: none;
  overflow-y: auto;
  line-height: 1.4;
  max-height: 200px;
}

.local-input::placeholder {
  color: #585b70;
}

.send-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: #6c7086;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  align-self: flex-end;
}

.send-btn:hover {
  color: #89b4fa;
  background: #313244;
}

.input-bar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.quick-commands-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: #181825;
  border: 1px solid #313244;
  border-bottom: none;
}

.quick-item {
  display: flex;
  align-items: center;
  height: 30px;
  border-bottom: 1px solid #313244;
}

.quick-cmd {
  flex: 1;
  padding: 0 12px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  color: #cdd6f4;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-cmd:hover {
  color: #89b4fa;
}

.quick-send-btn {
  width: 30px;
  border: none;
  background: none;
  color: #6c7086;
  cursor: pointer;
  font-size: 11px;
  flex-shrink: 0;
}

.quick-send-btn:hover {
  color: #a6e3a1;
}

.quick-del {
  width: 30px;
  border: none;
  background: none;
  color: #6c7086;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}

.quick-del:hover {
  color: #f38ba8;
}

.quick-add {
  height: 30px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #313244;
}

.quick-add-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #a6adc8;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  padding: 0 12px;
}

.quick-add-input::placeholder {
  color: #585b70;
}

.quick-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: #6c7086;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
  align-self: flex-end;
}

.quick-btn:hover,
.quick-btn.active {
  color: #89b4fa;
  background: #313244;
}
</style>
