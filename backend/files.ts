import { createHash } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import { MAX_BYTES, MAX_PAGES } from '../shared/domain'
import { AppError } from './repository'
export async function validateFile(bytes: Uint8Array, claimed: string) {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new AppError(400, 'File must be between 1 byte and 8 MB')
  const b = Buffer.from(bytes)
  let detected = ''
  if (b.subarray(0, 5).toString() === '%PDF-') detected = 'application/pdf'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9) detected = 'image/jpeg'
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.includes(Buffer.from('IEND'))) detected = 'image/png'
  if (!detected || detected !== claimed) throw new AppError(400, 'File contents do not match a supported PDF, JPEG or PNG')
  if (detected === 'application/pdf') {
    try {
      const pdf = await PDFDocument.load(b, { updateMetadata: false })
      if (pdf.getPageCount() < 1 || pdf.getPageCount() > MAX_PAGES) throw new Error('pages')
    } catch { throw new AppError(400, 'Use an unencrypted, valid PDF with 1–10 pages') }
  }
  return createHash('sha256').update(bytes).digest('hex')
}
export interface Files {
  request(key: string, type: string, size: number): Promise<{ url: string; fields?: Record<string, string>; method: 'POST' | 'PUT' }>
  read(key: string): Promise<Uint8Array>
  write?(key: string, bytes: Uint8Array): Promise<void>
  view(key: string, type: string): Promise<string>
  remove(key: string): Promise<void>
}
