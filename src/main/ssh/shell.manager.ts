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
    // 如果已存在同名会话，先断开清理，避免竞争条件
    if (this.sessions.has(id)) this.disconnect(id)

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
          if (err) {
            client.end()
            return reject(err)
          }
          this.sessions.set(id, { client, shell, config })
          shell.on('data', (d) => this.onData?.(id, d.toString()))
          shell.stderr?.on('data', (d) => this.onData?.(id, d.toString()))
          shell.stderr?.on('error', (e) =>
            console.error(`[ssh] shell stderr error for ${id}:`, e.message)
          )
          shell.on('close', () => {
            this.sessions.delete(id)
            this.onDisconnect?.(id)
          })
          if (config.execCommand) {
            shell.write(config.execCommand + '\n')
          }
          resolve()
        })
      })

      client.on('error', (err) => {
        if (!settled) {
          clearTimeout(timer)
          settled = true
          reject(err)
        } else {
          this.onError?.(id, err.message)
        }
      })

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        keepaliveInterval: 30000,
        keepaliveCountMax: 3
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
      try {
        s.shell.close()
      } catch (e) {
        console.error(`[ssh] error closing shell for ${id}:`, e)
      }
      try {
        s.client.end()
      } catch (e) {
        console.error(`[ssh] error ending client for ${id}:`, e)
      }
      this.sessions.delete(id)
    }
  }
}
