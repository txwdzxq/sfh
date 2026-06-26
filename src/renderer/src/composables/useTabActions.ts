import { useConnectionStore } from '../stores/connection'

export function useTabActions(removeCache: (tabId: string) => void): {
  handleCloseTab: (id: string) => Promise<void>
  closeTabsToLeft: (id: string) => Promise<void>
  closeTabsToRight: (id: string) => Promise<void>
  closeAllTabs: () => Promise<void>
  onTabWheel: (e: WheelEvent) => void
} {
  const connectionStore = useConnectionStore()

  async function handleCloseTab(id: string): Promise<void> {
    removeCache(id)
    connectionStore.removeTab(id)
    await connectionStore.saveToDisk()
  }

  async function closeTabsToLeft(id: string): Promise<void> {
    const idx = connectionStore.tabs.value.findIndex((t) => t.id === id)
    if (idx <= 0) return
    const toClose = connectionStore.tabs.value.slice(0, idx)
    for (const tab of toClose) {
      removeCache(tab.id)
      connectionStore.removeTab(tab.id)
    }
    await connectionStore.saveToDisk()
  }

  async function closeTabsToRight(id: string): Promise<void> {
    const idx = connectionStore.tabs.value.findIndex((t) => t.id === id)
    if (idx === -1 || idx >= connectionStore.tabs.value.length - 1) return
    const toClose = connectionStore.tabs.value.slice(idx + 1)
    for (const tab of toClose) {
      removeCache(tab.id)
      connectionStore.removeTab(tab.id)
    }
    await connectionStore.saveToDisk()
  }

  async function closeAllTabs(): Promise<void> {
    const allIds = connectionStore.tabs.value.map((t) => t.id)
    for (const id of allIds) {
      removeCache(id)
      connectionStore.removeTab(id)
    }
    await connectionStore.saveToDisk()
  }

  function onTabWheel(e: WheelEvent): void {
    if (connectionStore.tabs.value.length < 2) return
    const curIdx = connectionStore.tabs.value.findIndex(
      (t) => t.id === connectionStore.activeTabId.value
    )
    if (curIdx === -1) return
    const nextIdx = e.deltaY > 0 ? curIdx + 1 : curIdx - 1
    if (nextIdx < 0 || nextIdx >= connectionStore.tabs.value.length) return
    connectionStore.setActiveTab(connectionStore.tabs.value[nextIdx].id)
  }

  return {
    handleCloseTab,
    closeTabsToLeft,
    closeTabsToRight,
    closeAllTabs,
    onTabWheel
  }
}
