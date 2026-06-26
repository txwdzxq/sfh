import { nextTick, type Ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useConnectionStore } from '../stores/connection'
import type { SshConnectionConfig } from '../../../main/ssh/types'

interface SessionTab {
  id: string
  connected: boolean
  ftpConnected: boolean
  loading: boolean
  name: string
  config: SshConnectionConfig
}

export function useSessionCallbacks(params: {
  handleFtpPreload: (tabId: string) => Promise<boolean>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionRefs: Ref<Record<string, any>>
}): {
  onConnected: (tab: SessionTab) => Promise<void>
  onError: (tab: { error: string | null; loading: boolean }, msg: string) => void
} {
  const settingsStore = useSettingsStore()
  const { activeTabId } = useConnectionStore()

  async function onConnected(tab: SessionTab): Promise<void> {
    console.log(`[app] tab connected`)
    tab.connected = true
    tab.loading = false
    if (settingsStore.autoFtp.value && tab.name && tab.config) {
      const ok = await params.handleFtpPreload(tab.id)
      if (ok) tab.ftpConnected = true
    }
    if (tab.id === activeTabId.value) {
      nextTick(() => params.sessionRefs.value[tab.id]?.focusAndFit())
    }
  }

  function onError(tab: { error: string | null; loading: boolean }, msg: string): void {
    console.error(`[app] tab error: ${msg}`)
    tab.error = msg
    tab.loading = false
  }

  return { onConnected, onError }
}
