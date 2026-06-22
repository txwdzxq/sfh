import { useSettingsStore } from '../stores/settings'
import { useConnectionStore } from '../stores/connection'
import { useTransferStore } from '../stores/transfer'
import { deepClone } from '../utils/deepClone'

export function useTabPersistence() {
  const settingsStore = useSettingsStore()
  const connectionStore = useConnectionStore()
  const transferStore = useTransferStore()

  async function persistTabs(): Promise<void> {
    const list = connectionStore.tabs.value.map((t) => ({
      name: t.name,
      config: deepClone(t.config)
    }))
    settingsStore.savedTabs.value = list
    settingsStore.savedTransfers.value = transferStore.serializeQueue()
    await settingsStore.flush()
  }

  return { persistTabs }
}
