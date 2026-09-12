import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { AppError, type Repository } from './repository'
const credentials = z.object({ email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(12).max(128) })
const digest = (s: string) => createHash('sha256').update(s).digest('hex')
export class LocalAuth {
  constructor(public repo: Repository) {}
  async signup(body: unknown) {
    const { email, password } = credentials.parse(body); const salt = randomBytes(16).toString('hex')
    try { await this.repo.put({ pk: `EMAIL#${email}`, sk: 'ACCOUNT', version: 1, data: { id: randomUUID(), email, salt, hash: scryptSync(password, salt, 64).toString('hex') } }, 0) } catch { throw new AppError(409, 'Unable to create that account. Try signing in.') }
    return this.login(body)
  }
  async login(body: unknown) {
    const { email, password } = credentials.parse(body)
    const account = (await this.repo.get(`EMAIL#${email}`, 'ACCOUNT'))?.data
    const actual = scryptSync(password, account?.salt || 'missing-account', 64)
    if (!account || !timingSafeEqual(actual, Buffer.from(account.hash, 'hex'))) throw new AppError(401, 'Email or password is incorrect')
    const token = randomBytes(32).toString('hex')
    await this.repo.put({ pk: `SESSION#${digest(token)}`, sk: 'SESSION', version: 1, expiresAt: Math.floor(Date.now() / 1000) + 86400, data: { id: account.id, email } }, 0)
    return token
  }
  async identify(token?: string) { if (!token) throw new AppError(401, 'Please sign in'); const record = await this.repo.get(`SESSION#${digest(token)}`, 'SESSION'); if (!record || (record.expiresAt || 0) <= Date.now() / 1000) throw new AppError(401, 'Your session expired. Please sign in.'); return record.data as { id: string; email: string } }
  async logout(token?: string) { if (token) await this.repo.remove(`SESSION#${digest(token)}`, 'SESSION') }
}
