import { ref, nextTick, onUnmounted } from 'vue'

export function useTabContextMenu() {
  const contextMenu = ref<{ x: number; y: number; tabId: string } | null>(null)
  const menuEl = ref<HTMLElement | null>(null)
  let menuCleanup: (() => void) | null = null

  onUnmounted(() => {
    menuCleanup?.()
  })

  function openContextMenu(e: MouseEvent, tabId: string): void {
    closeContextMenu()
    contextMenu.value = { x: e.clientX, y: e.clientY, tabId }
    nextTick(() => {
      document.addEventListener('mousedown', onDocumentMouseDown)
      menuCleanup = () => document.removeEventListener('mousedown', onDocumentMouseDown)
    })
  }

  function closeContextMenu(): void {
    contextMenu.value = null
    menuCleanup?.()
    menuCleanup = null
  }

  function onDocumentMouseDown(e: MouseEvent): void {
    if (menuEl.value && !menuEl.value.contains(e.target as Node)) {
      closeContextMenu()
    }
  }

  return { contextMenu, menuEl, openContextMenu, closeContextMenu }
}
