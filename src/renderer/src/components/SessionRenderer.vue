<script setup lang="ts">
import type { Tab } from '../stores/connection'
import type { FtpCacheEntry } from '../composables/useFtpCache'
import SshSession from './SshSession.vue'
import FtpSession from './FtpSession.vue'

defineProps<{
  tabs: Tab[]
  activeTabId: string | null
  ftpCache: Record<string, FtpCacheEntry>
  setSessionRef: (tabId: string, el: unknown) => void
}>()

const emit = defineEmits<{
  connected: [tab: Tab]
  error: [tab: Tab, msg: string]
  loaded: [tabId: string, data: FtpCacheEntry]
  downloadStart: [x: number, y: number, filename: string]
  showQueue: []
}>()

function onLoaded(tabId: string, data: FtpCacheEntry): void {
  emit('loaded', tabId, data)
}
</script>

<template>
  <div v-for="tab in tabs" v-show="tab.id === activeTabId" :key="tab.id" class="session-wrapper">
    <SshSession
      v-show="tab.subTab === 'ssh'"
      :ref="(el) => setSessionRef(tab.id, el)"
      :tab-id="tab.id"
      :config="tab.config"
      @connected="emit('connected', tab)"
      @error="(msg) => emit('error', tab, msg)"
    />
    <FtpSession
      v-if="tab.subTab === 'ftp'"
      :tab-id="tab.id"
      :initial-path="ftpCache[tab.id]?.path"
      :initial-entries="ftpCache[tab.id]?.entries"
      @loaded="(data) => onLoaded(tab.id, data)"
      @download-start="(x, y, filename) => emit('downloadStart', x, y, filename)"
      @show-queue="emit('showQueue')"
    />
  </div>
</template>
