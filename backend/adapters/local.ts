import { mkdir, readFile, writeFile, rename, unlink, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { Conflict, type Repository, type RecordItem } from '../repository'
export class LocalRepository implements Repository {
  private tail: Promise<unknown> = Promise.resolve()
  constructor(public directory = resolve(process.env.INVOXA_DATA_DIR || '.data')) {}
  private path(pk: string, sk: string) { return join(this.directory, `${createHash('sha256').update(`${pk}\0${sk}`).digest('hex')}.json`) }
  async get(pk: string, sk: string) { try { return JSON.parse(await readFile(this.path(pk, sk), 'utf8')) as RecordItem } catch (e: any) { if (e.code === 'ENOENT') return; throw e } }
  async all() { await mkdir(this.directory, { recursive: true, mode: 0o700 }); const files = (await readdir(this.directory)).filter(f => f.endsWith('.json')); return Promise.all(files.map(async f => JSON.parse(await readFile(join(this.directory, f), 'utf8')) as RecordItem)) }
  async list(pk: string, prefix: string) { return (await this.all()).filter(r => r.pk === pk && r.sk.startsWith(prefix)) }
  async workspaces() { return (await this.all()).filter(r => r.sk === 'WORKSPACE') }
  async put(item: RecordItem, expected?: number) {
    const op = this.tail.then(async () => {
      const old = await this.get(item.pk, item.sk)
      if (expected === 0 ? !!old : expected !== undefined && old?.version !== expected) throw new Conflict()
      await mkdir(this.directory, { recursive: true, mode: 0o700 })
      const path = this.path(item.pk, item.sk); const temp = `${path}.${randomUUID()}.tmp`
      await writeFile(temp, JSON.stringify(item), { mode: 0o600 }); await rename(temp, path)
    }); this.tail = op.catch(() => {}); await op
  }
  async remove(pk: string, sk: string) { const op = this.tail.then(() => unlink(this.path(pk, sk)).catch((e: any) => { if (e.code !== 'ENOENT') throw e })); this.tail = op.catch(() => {}); await op }
}
