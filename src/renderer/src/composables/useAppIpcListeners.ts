import { onMounted, onUnmounted, type Ref } from 'vue'

export function useAppIpcListeners(params: {
  mainVerticalRef: Ref<HTMLElement | null>
  onResize: () => void
  resizeCleanup: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionRefs: Ref<Record<string, any>>
  activeTabId: Ref<string | null>
  addOrUpdate: (data: {
    id: string
    filename: string
    type: 'upload' | 'download'
    transferred: number
    total: number
    speed: number
    tabId?: string
    remotePath?: string
    localPath?: string
    connectionKey?: string
  }) => void
  markComplete: (id: string, localPath?: string, transferred?: number, total?: number) => void
  markError: (id: string, error: string) => void
  markCancelled: (id: string) => void
  onDisconnected: (id: string) => void
}): void {
  let disconnectCleanup: (() => void) | null = null
  const transferCleanups: (() => void)[] = []
  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    disconnectCleanup = window.api.onDisconnect((e) => {
      params.onDisconnected(e.id)
    })
    transferCleanups.push(
      window.api.onTransferProgress((data) => params.addOrUpdate(data)),
      window.api.onTransferComplete((data) =>
        params.markComplete(data.id, data.localPath, data.transferred, data.total)
      ),
      window.api.onTransferError((data) => params.markError(data.id, data.error)),
      window.api.onTransferCancelled((data) => params.markCancelled(data.id))
    )
    window.addEventListener('resize', params.onResize)
    resizeObserver = new ResizeObserver(() => {
      const id = params.activeTabId.value
      if (id) {
        params.sessionRefs.value[id]?.focusAndFit()
      }
    })
    if (params.mainVerticalRef.value) {
      resizeObserver.observe(params.mainVerticalRef.value)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('resize', params.onResize)
    params.resizeCleanup()
    disconnectCleanup?.()
    transferCleanups.forEach((fn) => fn())
    resizeObserver?.disconnect()
  })
}
