import type { SettingsData } from '../../../shared/types'

export const settingsService = {
  getSettings: (): Promise<SettingsData> => window.api.getSettings(),
  saveSettings: (data: SettingsData): Promise<void> => window.api.saveSettings(data)
}
