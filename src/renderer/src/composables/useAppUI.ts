import { ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useTransferStore } from '../stores/transfer'

export function useAppUI() {
  const settingsStore = useSettingsStore()
  const { lastActiveTab } = useTransferStore()

  const showSettings = ref(false)
  const showAbout = ref(false)
  const showQueue = ref(false)

  const sessionsPinned = settingsStore.sessionsPinned
  const queuePinned = settingsStore.queuePinned

  watch(sessionsPinned, () => settingsStore.flush())
  watch(queuePinned, () => settingsStore.flush())

  function onShowQueue(): void {
    if (settingsStore.showQueueOnDownload.value) {
      lastActiveTab.value = 'download'
      showQueue.value = true
    }
  }

  function onSettings(): void {
    showSettings.value = true
  }

  function onAbout(): void {
    showAbout.value = true
  }

  function toggleQueue(): void {
    showQueue.value = !showQueue.value
  }

  return {
    showSettings,
    showAbout,
    showQueue,
    sessionsPinned,
    queuePinned,
    onShowQueue,
    onSettings,
    onAbout,
    toggleQueue
  }
}
