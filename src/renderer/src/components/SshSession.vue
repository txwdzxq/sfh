<script setup lang="ts">
// SSH 会话组件 — 管理连接生命周期：连接中 / 已连接 / 已断开 / 错误

import { onMounted, onUnmounted, ref, nextTick } from 'vue'
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

function focusAndFit(): void {
  terminalRef.value?.focusAndFit()
}

defineExpose({ focusAndFit })

// 生命周期竞态保护：组件卸载后忽略异步结果
let active = true

onMounted(async () => {
  // 连接前获取终端实际尺寸，确保 PTY 以正确列数创建，避免 zsh PROMPT_EOL_MARK % 溢出
  await nextTick()
  const dims = terminalRef.value?.fitAndGetDimensions?.()
  console.log(
    `[session] connecting tab=${props.tabId} ${props.config.username}@${props.config.host}:${props.config.port} cols=${dims?.cols ?? 80} rows=${dims?.rows ?? 24}`
  )
  try {
    await window.api.connect(props.tabId, { ...props.config }, dims?.cols, dims?.rows)
    if (!active) return // 已卸载，忽略结果
    console.log(`[session] connected tab=${props.tabId}`)
    status.value = 'connected'
    nextTick(() => terminalRef.value?.markConnected())
    emit('connected')

    const tab = tabs.value.find((t) => t.id === props.tabId)
    if (tab) tab.connected = true
  } catch (err: unknown) {
    if (!active) return // 已卸载，忽略结果
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[session] error tab=${props.tabId}: ${message}`)
    status.value = 'error'
    errorMsg.value = message
    emit('error', message)
  }
})

onUnmounted(() => {
  active = false
  window.api.disconnect(props.tabId)
})
</script>

<template>
  <div class="session-container">
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
  </div>
</template>

<style scoped>
.session-container {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
