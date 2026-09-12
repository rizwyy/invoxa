import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHash } from 'node:crypto'
import type { Files } from '../files'
export class S3Files implements Files {
  client = new S3Client({})
  constructor(public bucket = process.env.INVOXA_BUCKET || '') { if (!bucket) throw new Error('INVOXA_BUCKET is required') }
  async request(key: string, type: string, size: number) {
    const post = await createPresignedPost(this.client, { Bucket: this.bucket, Key: key, Expires: 120, Fields: { 'Content-Type': type, 'x-amz-server-side-encryption': 'AES256' }, Conditions: [['content-length-range', size, size], ['eq', '$Content-Type', type], ['eq', '$x-amz-server-side-encryption', 'AES256']] })
    return { ...post, method: 'POST' as const }
  }
  async write(key: string, bytes: Uint8Array) {
    try { await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ServerSideEncryption: 'AES256', IfNoneMatch: '*' })) }
    catch (e: any) { if (e.name !== 'PreconditionFailed') throw e; const old = await this.read(key); if (createHash('sha256').update(old).digest('hex') !== createHash('sha256').update(bytes).digest('hex')) throw new Error('Original document is already frozen') }
  }
  async read(key: string) { const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key })); if ((result.ContentLength || 0) > 8 * 1024 * 1024) throw new Error('Oversized file'); return (await result.Body?.transformToByteArray()) || new Uint8Array() }
  async view(key: string, type: string) { return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentType: type, ResponseContentDisposition: 'inline; filename="invoice"' }), { expiresIn: 60 }) }
  async remove(key: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })) }
}
