import { ref } from 'vue'

export function useTabDrag() {
  const dragIndex = ref<number | null>(null)
  const dragOverIndex = ref<number | null>(null)

  function onDragStart(index: number): void {
    dragIndex.value = index
  }

  function onDragOver(index: number): void {
    if (dragIndex.value === null || dragIndex.value === index) return
    dragOverIndex.value = index
  }

  function onDragLeave(): void {
    dragOverIndex.value = null
  }

  function doDrop(
    index: number,
    moveFn: (from: number, to: number) => void,
    onDone?: () => void
  ): void {
    if (dragIndex.value !== null && dragIndex.value !== index) {
      moveFn(dragIndex.value, index)
      onDone?.()
    }
    dragIndex.value = null
    dragOverIndex.value = null
  }

  function onDragEnd(): void {
    dragIndex.value = null
    dragOverIndex.value = null
  }

  return { dragIndex, dragOverIndex, onDragStart, onDragOver, onDragLeave, doDrop, onDragEnd }
}
