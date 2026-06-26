import type { Ref } from 'vue'
import { useConnectionStore } from '../stores/connection'
import { useTabPersistence } from './useTabPersistence'
import type { SshConnectionConfig, SshConnection } from '../../../main/ssh/types'

export function useSessionActions(params: {
  showDialog: Ref<boolean>
  editSession: Ref<SshConnection | null>
}): {
  openDialog: () => void
  handleSessionEdit: (session: SshConnection) => void
  handleConnect: (config: SshConnectionConfig, name: string) => Promise<void>
  handleUpdate: (id: string, config: SshConnectionConfig, name: string) => Promise<void>
  closeDialog: () => void
  handleSessionSelect: (session: SshConnection) => Promise<void>
  handleSessionDelete: (id: string) => Promise<void>
  handleExport: () => Promise<void>
  handleImport: () => Promise<void>
} {
  const connectionStore = useConnectionStore()
  const { persistTabs } = useTabPersistence()

  function openDialog(): void {
    params.editSession.value = null
    params.showDialog.value = true
  }

  function handleSessionEdit(session: SshConnection): void {
    params.editSession.value = session
    params.showDialog.value = true
    connectionStore.closeSessions()
  }

  async function handleConnect(config: SshConnectionConfig, name: string): Promise<void> {
    console.log(`[app] connect: ${name}`)
    connectionStore.addTab(config, name)
    try {
      await connectionStore.saveConnectionByConfig(config, name)
    } catch (e) {
      console.error('[app] save failed:', e)
    }
    params.showDialog.value = false
    await persistTabs()
  }

  async function handleUpdate(
    id: string,
    config: SshConnectionConfig,
    name: string
  ): Promise<void> {
    console.log(`[app] update: ${name}`)
    try {
      await connectionStore.updateConnection(id, config, name)
    } catch (e) {
      console.error('[app] update failed:', e)
    }
    params.showDialog.value = false
  }

  function closeDialog(): void {
    params.showDialog.value = false
  }

  async function handleSessionSelect(session: SshConnection): Promise<void> {
    console.log(`[app] session select: ${session.name}`)
    connectionStore.addTab(session.config, session.name)
    connectionStore.closeSessions()
    await persistTabs()
  }

  async function handleSessionDelete(id: string): Promise<void> {
    await connectionStore.deleteConnection(id)
  }

  async function handleExport(): Promise<void> {
    const data = JSON.stringify(connectionStore.savedConnections.value, null, 2)
    await window.api.exportConnections(data)
  }

  async function handleImport(): Promise<void> {
    const data = await window.api.importConnections()
    if (!data || !Array.isArray(data)) return
    const connections = data as SshConnection[]
    for (const conn of connections) {
      if (conn.config && conn.name) {
        await connectionStore.saveConnectionByConfig(conn.config, conn.name)
      }
    }
  }

  return {
    openDialog,
    handleSessionEdit,
    handleConnect,
    handleUpdate,
    closeDialog,
    handleSessionSelect,
    handleSessionDelete,
    handleExport,
    handleImport
  }
}
