import { ref, watch, nextTick } from 'vue'
import { useConnectionStore } from '../stores/connection'

export function useTabManager() {
  const connectionStore = useConnectionStore()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRefs = ref<Record<string, any>>({})
  function setSessionRef(tabId: string, el: unknown): void {
    if (el) {
      sessionRefs.value[tabId] = el
    } else {
      delete sessionRefs.value[tabId]
    }
  }

  watch(
    () => connectionStore.activeTabId.value,
    (id: string | null) => {
      if (!id) return
      nextTick(() => sessionRefs.value[id]?.focusAndFit())
    }
  )

  return {
    sessionRefs,
    setSessionRef
  }
}
