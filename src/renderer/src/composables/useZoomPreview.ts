import { ref, computed } from 'vue'

export function useZoomPreview(getCurrentZoom: () => number) {
  const previewZoom = ref<number | null>(null)

  const appTransform = computed(() => {
    if (previewZoom.value === null) return {}
    const current = getCurrentZoom() || 1
    const ratio = previewZoom.value / current
    return {
      transform: `scale(${ratio})`,
      'transform-origin': 'top left',
      overflow: 'visible'
    }
  })

  function onZoomDrag(factor: number): void {
    previewZoom.value = factor
  }

  function onZoomApply(factor: number): void {
    try {
      window.api.setZoomFactor(factor)
    } catch (e) {
      console.error('[app] setZoomFactor failed:', e)
    }
    previewZoom.value = null
  }

  return { previewZoom, appTransform, onZoomDrag, onZoomApply }
}
