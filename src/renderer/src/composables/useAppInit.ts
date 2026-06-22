import { ref, readonly } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '../stores/connection'
import { useSettingsStore } from '../stores/settings'

export type InitPhase = 'booting' | 'loading' | 'ready' | 'error'

export function useAppInit() {
  const phase = ref<InitPhase>('booting')
  const initError = ref<string | null>(null)
  const settingsStore = useSettingsStore()
  const connectionStore = useConnectionStore()
  const { locale } = useI18n()

  async function init(): Promise<void> {
    phase.value = 'loading'

    try {
      // 1. 加载设置（决定 locale / theme / zoom / reopenTabs）
      await settingsStore.load()

      // 2. 应用语言
      locale.value = settingsStore.locale.value || 'zh-CN'

      // 3. 应用主题
      applyTheme(settingsStore.theme.value || 'mocha')

      // 4. 应用缩放
      try {
        window.api.setZoomFactor(settingsStore.zoom.value)
      } catch (e) {
        console.error('[app] setZoomFactor failed:', e)
      }

      // 5. 加载已保存的连接
      await connectionStore.loadSavedConnections()

      // 6. 恢复上次的标签页
      if (settingsStore.reopenTabs.value) {
        const restore = [...settingsStore.savedTabs.value]
        for (const tab of restore) {
          connectionStore.addTab(tab.config, tab.name)
        }
      }

      phase.value = 'ready'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[app] init failed:', msg)
      initError.value = msg
      phase.value = 'error'
    }
  }

  function applyTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme)
  }

  return {
    phase: readonly(phase),
    initError: readonly(initError),
    init,
    applyTheme
  }
}
