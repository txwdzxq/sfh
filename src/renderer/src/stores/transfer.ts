import { reactive, computed, toRefs } from 'vue'
import type { TransferItemData } from '../../../shared/types'

export interface TransferItem {
  id: string
  filename: string
  type: 'upload' | 'download'
  transferred: number
  total: number
  speed: number
  status: 'active' | 'completed' | 'error' | 'paused' | 'cancelled'
  error?: string
  localPath?: string
  tabId?: string
  remotePath?: string
  connectionKey?: string
}

const state = reactive({
  items: [] as TransferItem[],
  unseenUploads: 0,
  unseenDownloads: 0,
  queueOpen: false,
  lastActiveTab: 'upload' as 'upload' | 'download'
})

function findIndex(id: string): number {
  return state.items.findIndex((i) => i.id === id)
}

export function useTransferStore() {
  function addOrUpdate(data: {
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
  }): void {
    const idx = findIndex(data.id)
    if (idx >= 0) {
      const item = state.items[idx]
      item.transferred = data.transferred
      item.total = data.total
      item.speed = data.speed
      if (item.status === 'completed' || item.status === 'error') {
        item.status = 'active'
      }
    } else {
      if (!state.queueOpen) {
        if (data.type === 'upload') state.unseenUploads++
        else state.unseenDownloads++
      }
      state.items.push({
        id: data.id,
        filename: data.filename,
        type: data.type,
        transferred: data.transferred,
        total: data.total,
        speed: data.speed,
        status: 'active',
        tabId: data.tabId,
        remotePath: data.remotePath,
        localPath: data.localPath,
        connectionKey: data.connectionKey
      })
    }
  }

  function markComplete(id: string, localPath?: string): void {
    const idx = findIndex(id)
    if (idx >= 0) {
      state.items[idx].status = 'completed'
      if (localPath) state.items[idx].localPath = localPath
    }
  }

  function markError(id: string, error: string): void {
    const idx = findIndex(id)
    if (idx >= 0) {
      state.items[idx].status = 'error'
      state.items[idx].error = error
    }
  }

  function clearUnseen(): void {
    state.unseenUploads = 0
    state.unseenDownloads = 0
  }

  function setQueueOpen(val: boolean): void {
    state.queueOpen = val
  }

  function removeItem(id: string): void {
    state.items = state.items.filter((i) => i.id !== id)
  }

  function clearCompleted(): void {
    state.items = state.items.filter(
      (i) => i.status === 'active' || i.status === 'error' || i.status === 'paused'
    )
  }

  function markPaused(id: string): void {
    const idx = findIndex(id)
    if (idx >= 0) {
      state.items[idx].status = 'paused'
      state.items[idx].speed = 0
    }
  }

  function markActive(id: string): void {
    const idx = findIndex(id)
    if (idx >= 0 && state.items[idx].status === 'paused') {
      state.items[idx].status = 'active'
    }
  }

  function markCancelled(id: string): void {
    const idx = findIndex(id)
    if (idx >= 0) {
      state.items[idx].status = 'cancelled'
      state.items[idx].speed = 0
    }
  }

  const activeTransfers = computed(() => state.items.filter((i) => i.status === 'active'))
  const hasActive = computed(() => activeTransfers.value.length > 0)

  function serializeQueue(): TransferItemData[] {
    return JSON.parse(JSON.stringify(state.items))
  }

  function restoreQueue(items: TransferItemData[]): void {
    state.items = items.map((item) => ({
      ...item,
      status: item.status === 'active' ? 'paused' : item.status
    }))
  }

  return {
    ...toRefs(state),
    activeTransfers,
    hasActive,
    addOrUpdate,
    markComplete,
    markError,
    markPaused,
    markActive,
    markCancelled,
    clearCompleted,
    clearUnseen,
    setQueueOpen,
    removeItem,
    serializeQueue,
    restoreQueue
  }
}
