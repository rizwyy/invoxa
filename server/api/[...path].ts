import { ZodError } from 'zod'
import { localAuth, localService, localFiles } from '../../backend/local-runtime'
import { AppError, Conflict } from '../../backend/repository'
import { MAX_BYTES } from '../../shared/domain'
const attempts = new Map<string, { count: number; reset: number }>()
export default defineEventHandler(async event => {
  if (process.env.NUXT_PUBLIC_APP_MODE === 'aws') throw createError({ statusCode: 404, message: 'Use the configured AWS API' })
  // The local adapter is intentionally unavailable on public hosts or in an unapproved production process.
  const host = getRequestHeader(event, 'host') || ''
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) || (process.env.NODE_ENV === 'production' && process.env.INVOXA_ALLOW_LOCAL_PRODUCTION !== 'true')) throw createError({ statusCode: 403, message: 'Local mode is for loopback development only' })
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const method = event.method; const path = '/' + (getRouterParam(event, 'path') || '')
  try {
    if (!['GET', 'HEAD'].includes(method)) {
      const origin = getRequestHeader(event, 'origin')
      if (origin !== `http://${host}` && origin !== `https://${host}`) throw new AppError(403, 'Request origin is not allowed')
      const length = getRequestHeader(event, 'content-length'); if (!length) throw new AppError(411, 'Content-Length is required'); const size = Number(length)
      if (!Number.isFinite(size) || size < 0 || size > (path.startsWith('/local-upload/') ? MAX_BYTES : 32768)) throw new AppError(413, 'Request body is too large')
    }
    if (path === '/auth/login' || path === '/auth/signup') {
      if (method !== 'POST') throw new AppError(405, 'Use POST')
      const ip = event.node.req.socket.remoteAddress || 'local'; const now = Date.now()
      for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key)
      const rate = attempts.get(ip) || { count: 0, reset: now + 60000 }; rate.count++; attempts.set(ip, rate)
      if (rate.count > 20) throw new AppError(429, 'Too many attempts. Wait a minute and try again.')
      const token = await localAuth[path.endsWith('signup') ? 'signup' : 'login'](await readBody(event))
      setCookie(event, 'invoxa_session', token, { httpOnly: true, sameSite: 'strict', secure: false, path: '/', maxAge: 86400 })
      return { ok: true }
    }
    const token = getCookie(event, 'invoxa_session')
    if (path === '/auth/logout' && method === 'POST') { await localAuth.logout(token); deleteCookie(event, 'invoxa_session', { path: '/' }); return { ok: true } }
    const user = await localAuth.identify(token)
    if (path.startsWith('/local-upload/') && method === 'PUT') {
      const id = path.split('/').at(-1)!; const invoice = await localService.get(user, id)
      if (invoice.processing !== 'awaiting-upload') throw new AppError(409, 'Upload already completed')
      const body = await readRawBody(event, false)
      if (!body || body.length !== invoice.file!.size || body.length > MAX_BYTES) throw new AppError(400, 'File size does not match')
      await localFiles.write(invoice.file!.key, body)
      return { ok: true }
    }
    if (path.startsWith('/local-file/') && method === 'GET') {
      const invoice = await localService.get(user, path.split('/').at(-1)!)
      if (!invoice.file || invoice.processing === 'awaiting-upload' || invoice.processing === 'rejected') throw new AppError(404, 'Document is not ready')
      setResponseHeader(event, 'Content-Type', invoice.file.type)
      setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
      setResponseHeader(event, 'Content-Disposition', 'inline; filename="invoice"')
      setResponseHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'")
      return Buffer.from(await localFiles.read(invoice.file.key))
    }
    return await localService.handle(user, method, path, ['POST', 'PATCH'].includes(method) ? await readBody(event) : undefined)
  } catch (error) {
    if (error instanceof ZodError) throw createError({ statusCode: 400, message: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') })
    if (error instanceof AppError) throw createError({ statusCode: error.status, message: error.message })
    if (error instanceof Conflict) throw createError({ statusCode: 409, message: error.message })
    console.error('Local API error', error instanceof Error ? error.name : 'unknown')
    throw createError({ statusCode: 500, message: 'Unable to complete the request. Try again.' })
  }
})
