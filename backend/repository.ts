export interface RecordItem { pk: string; sk: string; version: number; data: any; expiresAt?: number }
export interface Repository {
  get(pk: string, sk: string): Promise<RecordItem | undefined>
  list(pk: string, prefix: string): Promise<RecordItem[]>
  put(item: RecordItem, expected?: number): Promise<void>
  remove(pk: string, sk: string): Promise<void>
  workspaces(): Promise<RecordItem[]>
}
export class Conflict extends Error { constructor() { super('This record changed. Reload it before saving again.') } }
export class AppError extends Error { constructor(public status: number, message: string) { super(message) } }
