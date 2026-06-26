import { ref, nextTick, onUnmounted, type Ref } from 'vue'
import type TabContextMenu from '../components/TabContextMenu.vue'

export function useTabContextMenu(menuEl: Ref<InstanceType<typeof TabContextMenu> | null>) {
  const contextMenu = ref<{ x: number; y: number; tabId: string } | null>(null)
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
    const root = menuEl.value?.$el
    if (root && !root.contains(e.target as Node)) {
      closeContextMenu()
    }
  }

  return { contextMenu, openContextMenu, closeContextMenu }
}
