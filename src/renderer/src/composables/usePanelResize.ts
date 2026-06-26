import { ref, type Ref } from 'vue'

export function usePanelResize(
  width: Ref<number>,
  options: { minWidth: number; maxWidth: number; direction: 'left' | 'right' }
) {
  const isResizing = ref(false)

  function onResizeStart(e: MouseEvent): void {
    e.preventDefault()
    isResizing.value = true
    const startX = e.clientX
    const startWidth = width.value

    function onMouseMove(e: MouseEvent): void {
      const delta = e.clientX - startX
      let newWidth: number
      if (options.direction === 'right') {
        newWidth = startWidth + delta
      } else {
        newWidth = startWidth - delta
      }
      width.value = Math.max(options.minWidth, Math.min(options.maxWidth, newWidth))
    }

    function onMouseUp(): void {
      isResizing.value = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return { isResizing, onResizeStart }
}
