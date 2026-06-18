import { ref, watch, nextTick } from 'vue'
import { useConnectionStore, Tab } from '../stores/connection'
import { SshConnectionConfig } from '../../../main/ssh/types'

export function useTabManager() {
  const connectionStore = useConnectionStore()
  
  // 会话引用管理
  const sessionRefs = ref<Record<string, any>>({})
  function setSessionRef(tabId: string, el: unknown): void {
    if (el) {
      sessionRefs.value[tabId] = el
    } else {
      delete sessionRefs.value[tabId]
    }
  }

  // 标签页交互逻辑
  async function handleCloseTab(id: string): Promise<void> {
    connectionStore.removeTab(id)
    await connectionStore.saveToDisk()
  }

  // 切换标签时自动聚焦
  watch(() => connectionStore.activeTabId, (id) => {
    if (!id) return
    nextTick(() => sessionRefs.value[id]?.focusAndFit())
  })

  return {
    connectionStore,
    sessionRefs,
    setSessionRef
  }
}
