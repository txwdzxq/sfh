<script setup lang="ts">
// 本地输入栏组件 — 快捷命令面板 + 文本输入 + 历史记录

import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  tabId: string
  connected: boolean
  subTab: 'ssh' | 'ftp'
}>()

const { t } = useI18n()

/* ---- 输入状态 ---- */
interface InputBarState {
  localInput: string
  inputHistory: string[]
  historyIndex: number
  showQuickCommands: boolean
}

const state = ref<InputBarState>({
  localInput: '',
  inputHistory: [],
  historyIndex: -1,
  showQuickCommands: false
})

/* ---- 快捷命令 ---- */
const QC_KEY = 'ssh-quick-commands'
const newCommand = ref('')
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
    state.value.localInput = cmd
  }
  state.value.showQuickCommands = false
}

function sendCommand(cmd: string): void {
  window.api.write(props.tabId, cmd + '\n')
  state.value.showQuickCommands = false
}

/* ---- 输入栏 ---- */
function autoResizeInput(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function sendLocalInput(): void {
  const text = state.value.localInput
  if (!text) return
  window.api.write(props.tabId, text + '\n')
  if (state.value.inputHistory[state.value.inputHistory.length - 1] !== text) {
    state.value.inputHistory.push(text)
    if (state.value.inputHistory.length > 500) state.value.inputHistory.shift()
  }
  state.value.historyIndex = -1
  state.value.localInput = ''
}

function handleInputKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendLocalInput()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (state.value.inputHistory.length === 0) return
    state.value.historyIndex =
      state.value.historyIndex === -1
        ? state.value.inputHistory.length - 1
        : Math.max(0, state.value.historyIndex - 1)
    state.value.localInput = state.value.inputHistory[state.value.historyIndex]
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (state.value.historyIndex === -1) return
    const newIdx = state.value.historyIndex + 1
    if (newIdx >= state.value.inputHistory.length) {
      state.value.historyIndex = -1
      state.value.localInput = ''
    } else {
      state.value.historyIndex = newIdx
      state.value.localInput = state.value.inputHistory[newIdx]
    }
    return
  }
}

/* ---- tabId 切换时重置输入状态 ---- */
watch(
  () => props.tabId,
  () => {
    state.value = {
      localInput: '',
      inputHistory: [],
      historyIndex: -1,
      showQuickCommands: false
    }
  }
)
</script>

<template>
  <div v-if="connected && subTab === 'ssh'" class="input-bar-wrapper">
    <div v-if="state.showQuickCommands" class="quick-commands-panel">
      <div v-for="(cmd, i) in quickCommands" :key="i" class="quick-item">
        <span class="quick-cmd" @click="selectCommand(cmd, $event)">{{ cmd }}</span>
        <button
          class="quick-send-btn"
          :title="t('sshSession.quickCommand.send')"
          @click="sendCommand(cmd)"
        >
          ▶
        </button>
        <button
          class="quick-del"
          :title="t('sshSession.quickCommand.remove')"
          @click="removeCommand(i)"
        >
          ×
        </button>
      </div>
      <div class="quick-add">
        <input
          v-model="newCommand"
          class="quick-add-input"
          :placeholder="t('sshSession.quickCommand.addPlaceholder')"
          @keydown.enter="addCommand"
        />
      </div>
    </div>
    <div class="local-input-bar">
      <button
        class="quick-btn"
        :class="{ active: state.showQuickCommands }"
        :title="t('sshSession.quickCommand.toggle')"
        @click="state.showQuickCommands = !state.showQuickCommands"
      >
        ⚡
      </button>
      <textarea
        v-model="state.localInput"
        class="local-input"
        rows="1"
        :placeholder="t('sshSession.localInput.placeholder')"
        @keydown="handleInputKeydown"
        @input="autoResizeInput($event.target as HTMLTextAreaElement)"
      ></textarea>
      <button class="send-btn" :title="t('sshSession.localInput.send')" @click="sendLocalInput">
        ⏎
      </button>
    </div>
  </div>
</template>

<style scoped>
.input-bar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.local-input-bar {
  display: flex;
  flex-shrink: 0;
  min-height: 36px;
  border-top: 1px solid var(--border);
  background: var(--bg-surface);
  align-items: flex-end;
}

.local-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  height: 36px;
  padding: 8px 12px;
  resize: none;
  overflow-y: auto;
  line-height: 1.4;
  max-height: 200px;
}

.local-input::placeholder {
  color: var(--bg-muted);
}

.send-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  align-self: flex-end;
}

.send-btn:hover {
  color: var(--accent);
  background: var(--bg-overlay);
}

.quick-commands-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-mantle);
  border: 1px solid var(--border);
  border-bottom: none;
}

.quick-item {
  display: flex;
  align-items: center;
  height: 30px;
  border-bottom: 1px solid var(--border);
}

.quick-cmd {
  flex: 1;
  padding: 0 12px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-cmd:hover {
  color: var(--accent);
}

.quick-send-btn {
  width: 30px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  flex-shrink: 0;
}

.quick-send-btn:hover {
  color: var(--success);
}

.quick-del {
  width: 30px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}

.quick-del:hover {
  color: var(--danger);
}

.quick-add {
  height: 30px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.quick-add-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  padding: 0 12px;
}

.quick-add-input::placeholder {
  color: var(--bg-muted);
}

.quick-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
  align-self: flex-end;
}

.quick-btn:hover,
.quick-btn.active {
  color: var(--accent);
  background: var(--bg-overlay);
}
</style>
