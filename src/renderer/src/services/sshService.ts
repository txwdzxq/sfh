import { SshConnectionConfig } from '../../../main/ssh/types'
import { SftpEntry } from '../../../main/ssh/manager'

export const sshService = {
  // SSH API
  connect: (id: string, config: SshConnectionConfig) => window.api.connect(id, config),
  write: (id: string, data: string) => window.api.write(id, data),
  resize: (id: string, cols: number, rows: number) => window.api.resize(id, cols, rows),
  disconnect: (id: string) => window.api.disconnect(id),
  fork: (sourceId: string, newId: string) => window.api.forkShell(sourceId, newId),
  
  // SFTP API
  readdir: (id: string, path: string): Promise<SftpEntry[]> => window.api.readdir(id, path),
  realpath: (id: string, path: string): Promise<string> => window.api.realpath(id, path),
  download: (id: string, remotePath: string) => window.api.download(id, remotePath),
  upload: (id: string, remoteDir: string) => window.api.upload(id, remoteDir),
  uploadFile: (id: string, localPath: string, remotePath: string) => window.api.uploadFile(id, localPath, remotePath),
  connectSftp: (id: string) => window.api.connectSftp(id),
  getPathForFile: (file: File) => window.api.getPathForFile(file),
}
