import { reactive, computed } from 'vue'

export interface TransferItem {
  id: string
  filename: string
  type: 'upload' | 'download'
  transferred: number
  total: number
  speed: number
  status: 'active' | 'completed' | 'error'
  error?: string
}

const state = reactive({
  items: [] as TransferItem[]
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
      state.items.push({
        id: data.id,
        filename: data.filename,
        type: data.type,
        transferred: data.transferred,
        total: data.total,
        speed: data.speed,
        status: 'active'
      })
    }
  }

  function markComplete(id: string): void {
    const idx = findIndex(id)
    if (idx >= 0) state.items[idx].status = 'completed'
  }

  function markError(id: string, error: string): void {
    const idx = findIndex(id)
    if (idx >= 0) {
      state.items[idx].status = 'error'
      state.items[idx].error = error
    }
  }

  function clearCompleted(): void {
    state.items = state.items.filter((i) => i.status === 'active' || i.status === 'error')
  }

  const activeTransfers = computed(() => state.items.filter((i) => i.status === 'active'))
  const hasActive = computed(() => activeTransfers.value.length > 0)
  const items = computed(() => state.items)

  return {
    state,
    items,
    activeTransfers,
    hasActive,
    addOrUpdate,
    markComplete,
    markError,
    clearCompleted
  }
}
