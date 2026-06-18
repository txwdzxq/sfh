import { AppSettings } from '../stores/settings'

export const settingsService = {
  getSettings: () => window.api.getSettings(),
  saveSettings: (settings: { settings: AppSettings; tabs: any[] }) => window.api.saveSettings(settings),
  getConnections: () => window.api.getConnections(),
  saveConnections: (connections: any[]) => window.api.saveConnections(connections),
  openPrivateKey: () => window.api.openPrivateKey(),
}
