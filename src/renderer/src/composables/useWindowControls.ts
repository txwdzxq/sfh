import type { Ref } from 'vue'

export function useWindowControls(
  persistFn: () => Promise<void>,
  hasActiveTransfers: Ref<boolean>,
  cancelAllTransfers: () => void
) {
  const pendingClose = ref(false)

  function minimizeWindow(): void {
    window.api.minimize()
  }

  function maximizeWindow(): void {
    window.api.maximize()
  }

  async function closeWindow(): Promise<void> {
    if (hasActiveTransfers.value) {
      pendingClose.value = true
      return
    }
    await persistFn()
    window.api.close()
  }

  async function confirmClose(): Promise<void> {
    pendingClose.value = false
    cancelAllTransfers()
    await persistFn()
    window.api.close()
  }

  function cancelClose(): void {
    pendingClose.value = false
  }

  function onBeforeUnload(): void {
    persistFn()
  }

  return {
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    confirmClose,
    cancelClose,
    pendingClose,
    onBeforeUnload
  }
}

import { ref } from 'vue'
