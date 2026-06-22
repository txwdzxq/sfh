import { ref } from 'vue'
import type { SftpEntry } from '../../../main/ssh/types'

export interface FtpCacheEntry {
  path: string
  entries: SftpEntry[]
}

export function useFtpCache() {
  const ftpCache = ref<Record<string, FtpCacheEntry>>({})

  async function handleFtpPreload(tabId: string): Promise<boolean> {
    try {
      await window.api.connectSftp(tabId)
      const resolved = await window.api.realpath(tabId, '.')
      const list = await window.api.readdir(tabId, resolved)
      const filtered = list.filter((e) => e.filename !== '.' && e.filename !== '..')
      filtered.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.filename.localeCompare(b.filename)
      })
      ftpCache.value[tabId] = { path: resolved, entries: filtered }
      return true
    } catch {
      return false
    }
  }

  function removeCache(tabId: string): void {
    delete ftpCache.value[tabId]
  }

  function clearAllCache(): void {
    ftpCache.value = {}
  }

  return { ftpCache, handleFtpPreload, removeCache, clearAllCache }
}
