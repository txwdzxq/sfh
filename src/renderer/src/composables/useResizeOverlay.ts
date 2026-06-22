import { ref } from 'vue'

export function useResizeOverlay() {
  const windowSize = ref({ w: window.innerWidth, h: window.innerHeight })
  const showSize = ref(false)
  let resizeTimer: ReturnType<typeof setTimeout> | null = null

  function onResize(): void {
    windowSize.value = { w: window.innerWidth, h: window.innerHeight }
    showSize.value = true
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      showSize.value = false
    }, 500)
  }

  function cleanup(): void {
    if (resizeTimer) clearTimeout(resizeTimer)
  }

  return { windowSize, showSize, onResize, cleanup }
}
