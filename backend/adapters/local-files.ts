import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import type { Files } from '../files'
export class LocalFiles implements Files {
  constructor(public directory: string) {}
  path(key: string) { return join(this.directory, 'files', createHash('sha256').update(key).digest('hex')) }
  async request(key: string) { return { url: `/api/local-upload/${encodeURIComponent(key.split('/').at(-1)!)}`, method: 'PUT' as const } }
  async read(key: string) { return new Uint8Array(await readFile(this.path(key))) }
  async write(key: string, bytes: Uint8Array) { await mkdir(join(this.directory, 'files'), { recursive: true, mode: 0o700 }); try { await writeFile(this.path(key), bytes, { mode: 0o600, flag: key.startsWith('documents/') ? 'wx' : 'w' }) } catch (e: any) { if (e.code !== 'EEXIST') throw e; const old = await this.read(key); if (!Buffer.from(old).equals(Buffer.from(bytes))) throw new Error('Original document is already frozen') } }
  async view(key: string) { return `/api/local-file/${encodeURIComponent(key.split('/').at(-1)!)}` }
  async remove(key: string) { await unlink(this.path(key)).catch((e: any) => { if (e.code !== 'ENOENT') throw e }) }
}
