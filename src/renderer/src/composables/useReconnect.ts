import type { Ref } from 'vue'
import { useConnectionStore } from '../stores/connection'
import type { FtpCacheEntry } from './useFtpCache'

export function useReconnect(ftpCache: Ref<Record<string, FtpCacheEntry>>): {
  reconnectTab: (tabId: string) => Promise<void>
} {
  const connectionStore = useConnectionStore()
  const reconnecting = new Set<string>()

  async function reconnectTab(tabId: string): Promise<void> {
    if (reconnecting.has(tabId)) return
    const tabs = connectionStore.tabs.value
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab || (tab.connected && tab.ftpConnected)) return
    reconnecting.add(tabId)
    tab.loading = true
    tab.error = null
    window.api.disconnect(tabId)
    try {
      await window.api.connect(tabId, { ...tab.config })
      tab.connected = true
    } catch (err: unknown) {
      tab.connected = false
      tab.loading = false
      tab.error = err instanceof Error ? err.message : String(err)
      return
    }
    try {
      await window.api.connectSftp(tabId)
      tab.ftpConnected = true
      const resolved = await window.api.realpath(tabId, '.')
      const list = await window.api.readdir(tabId, resolved)
      const filtered = list.filter((e) => e.filename !== '.' && e.filename !== '..')
      filtered.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.filename.localeCompare(b.filename)
      })
      ftpCache.value[tabId] = { path: resolved, entries: filtered }
    } catch {
      tab.ftpConnected = false
    }
    tab.loading = false
    reconnecting.delete(tabId)
  }

  return { reconnectTab }
}
