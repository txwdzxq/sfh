import { Client, ClientChannel } from 'ssh2'
import { SshConnectionConfig } from './types'

export interface ShellSession {
  client: Client
  shell: ClientChannel
  config: SshConnectionConfig
}

export class SSHShellManager {
  private sessions = new Map<string, ShellSession>()
  
  onData: ((id: string, data: string) => void) | null = null
  onError: ((id: string, message: string) => void) | null = null
  onDisconnect: ((id: string) => void) | null = null

  async connect(id: string, config: SshConnectionConfig): Promise<void> {
    if (this.sessions.has(id)) throw new Error('Connection exists')

    const client = new Client()
    return new Promise((resolve, reject) => {
      let settled = false
      const timeout = config.readyTimeout ?? 10000
      
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        client.end()
        reject(new Error('Connection timed out'))
      }, timeout + 2000)

      client.on('ready', () => {
        clearTimeout(timer)
        settled = true
        client.shell({ term: 'xterm-256color' }, (err, shell) => {
          if (err) return reject(err)
          this.sessions.set(id, { client, shell, config })
          shell.on('data', (d) => this.onData?.(id, d.toString()))
          shell.stderr?.on('data', (d) => this.onData?.(id, d.toString()))
          shell.on('close', () => {
            this.sessions.delete(id)
            this.onDisconnect?.(id)
          })
          resolve()
        })
      })

      client.on('error', (err) => {
        if (settled) return
        clearTimeout(timer)
        settled = true
        reject(err)
      })

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey
      })
    })
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.shell.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.shell.setWindow(rows, cols, 0, 0)
  }

  getSession(id: string): ShellSession | undefined {
    return this.sessions.get(id)
  }

  disconnect(id: string): void {
    const s = this.sessions.get(id)
    if (s) {
      s.shell.close()
      s.client.end()
      this.sessions.delete(id)
    }
  }
}
