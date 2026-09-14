import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { ZodError } from 'zod'
import { DynamoRepository } from '../adapters/dynamo'
import { S3Files } from '../adapters/s3'
import { TextractExtractor } from '../adapters/textract'
import { InvoiceService } from '../service'
import { AppError, Conflict } from '../repository'
let service: InvoiceService
let verifier: ReturnType<typeof CognitoJwtVerifier.create>
export const handler: APIGatewayProxyHandlerV2 = async event => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  const reply = (statusCode: number, body: unknown) => ({ statusCode, headers, body: JSON.stringify(body) })
  try {
    // Browsers send an unauthenticated preflight before requests with a bearer token.
    // API Gateway adds the configured CORS headers to this response.
    if (event.requestContext.http.method === 'OPTIONS') return { statusCode: 204, headers }
    const token = event.headers.authorization?.match(/^Bearer (.+)$/i)?.[1]
    if (!token) throw new AppError(401, 'Please sign in')
    verifier ||= CognitoJwtVerifier.create({ userPoolId: process.env.COGNITO_USER_POOL_ID!, clientId: process.env.COGNITO_CLIENT_ID!, tokenUse: 'access' })
    let payload
    try { payload = await verifier.verify(token) } catch { throw new AppError(401, 'Session expired or invalid. Please sign in again.') }
    // Verified subject is the only source of identity. Email is obtained from Cognito, not user input.
    const { CognitoIdentityProviderClient, GetUserCommand } = await import('@aws-sdk/client-cognito-identity-provider')
    const cognito = new CognitoIdentityProviderClient({})
    const profile = await cognito.send(new GetUserCommand({ AccessToken: token }))
    const email = profile.UserAttributes?.find(a => a.Name === 'email')?.Value
    const verified = profile.UserAttributes?.find(a => a.Name === 'email_verified')?.Value === 'true'
    if (!email || !verified) throw new AppError(403, 'Verify your email before using Invoxa')
    service ||= new InvoiceService(new DynamoRepository(), new S3Files(), new TextractExtractor())
    const raw = event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8').toString() : ''
    if (Buffer.byteLength(raw) > 32768) throw new AppError(413, 'Request is too large')
    let body: unknown
    try { body = raw ? JSON.parse(raw) : undefined } catch { throw new AppError(400, 'Invalid JSON') }
    const path = event.rawPath.replace(/^\/api(?=\/)/, '')
    return reply(200, await service.handle({ id: payload.sub, email }, event.requestContext.http.method, path, body))
  } catch (e) {
    if (e instanceof Error && e.name === 'NotAuthorizedException') return reply(401, { message: 'Session expired or revoked. Please sign in again.' })
    if (e instanceof ZodError) return reply(400, { message: e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') })
    if (e instanceof AppError) return reply(e.status, { message: e.message })
    if (e instanceof Conflict) return reply(409, { message: e.message })
    console.error(JSON.stringify({ event: 'api_failure', requestId: event.requestContext.requestId, errorType: e instanceof Error ? e.name : 'unknown' }))
    return reply(500, { message: 'Unable to complete the request. Try again.' })
  }
}
