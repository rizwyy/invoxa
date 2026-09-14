# AWS handoff — resources you configure

No resources have been provisioned or deployed by this project. Local mode performs no AWS calls. These instructions describe the contract expected by the supplied code; actual AWS behavior must be verified in your account before inviting customers.

## Scope and architecture

The pilot supports supplier invoices in INR, one owner per workspace, full paid/unpaid state, archival rather than permanent deletion, and at most 1,000 upload reservations per workspace / 50 per UTC day. Each invoice has at most 10 PDF pages / 8 MB. Failed or abandoned reservations consume quota deliberately; contact the operator to reset a quota after investigation. No billing subscription, accounting ledger, GST filing, team invitations, partial payments, bank reconciliation, Bedrock or RAG.

Frontend (Nuxt SPA) → Cognito authorization code + PKCE → API Gateway HTTP API → API Lambda → DynamoDB + S3 + Textract. Textract → SNS → SQS → completion Lambda. EventBridge Scheduler → reminder Lambda → SES.

Uploads: authenticated reservation → short-lived S3 POST to `incoming/` → authenticated `/invoices/:id/complete` → bytes checked and frozen at `documents/` → Textract started asynchronously. The completion request, not an S3 event, starts processing. The frontend must call it after a successful upload. Browser closure before completion leaves an incomplete record; reopen/retry or archive. Do not add an S3 processing trigger to this implementation.

## Before you create anything: costs and removal

Check the AWS console for current **Mumbai** availability, Free Plan eligibility and regional rates. No assumed credits or free allowances are included in the unit-cost design. Keep all processing resources in one region. Use an account budget that excludes credits/refunds to see underlying consumption, and confirm recipient emails. Alerts do not cap charges.

| Resource | Why it exists | Charging and idle behavior | Remove / disable |
| --- | --- | --- | --- |
| Cognito user pool | Customer signup, verification, login, recovery | MAUs by tier; qualifying Lite/Essentials direct sign-ins have a free allowance. No unused basic-pool base fee; email/SMS/add-ons may cost separately | Disable app client or delete test pool (destroys accounts) |
| API Gateway HTTP API | HTTP routing, JWT authorizer, throttling | Requests and transfer; no request cost while idle | Delete API / routes |
| Lambda (three functions) | API, OCR completion, daily digest | Requests + memory-duration. No idle execution charge without provisioned concurrency | Disable event mappings/schedule, delete functions |
| DynamoDB on-demand | Memberships, invoices, quotas, reminder claims | Reads, writes, storage; storage and optional backups cost while idle | Export if needed, delete table and retained backups |
| S3 private bucket | Uploaded and frozen source files | Storage, requests, transfer; stored versions cost while idle | Delete all object versions, delete markers, incomplete uploads, then bucket |
| Textract AnalyzeExpense | Extract supplier and invoice header fields | Per processed page, including retries; no idle charge | Stop submissions, revoke permissions |
| SNS + SQS + DLQ | Deliver/retry extraction completion notifications | Requests/delivery; idle polling can consume requests | Disable mapping, remove subscription, queues and topic |
| EventBridge Scheduler | One daily reminder run | Invocations; no compute server kept running | Disable/delete schedule |
| SES | Owner reminder emails / production auth email | Messages, data and optional features; avoid dedicated IPs | Disable sending/schedule; delete unused identities |
| CloudWatch | Logs and actionable failure alarms | Log ingestion/retention, metrics and alarms; retained data/alarms can cost while idle | Set 7-day logs, delete unused log groups and alarms |
| IAM roles/policies | Allow services only the required operations | No additional IAM fee | Detach/delete when resources are gone |
| Frontend hosting + domain | Serve the built SPA over HTTPS | Provider-specific; separate from the Lambda bundles | Remove deployment and renewals |

Example only: AWS publishes an Oregon AnalyzeExpense example at $0.01/page. 1,000 pages would be $10 for extraction at that rate, before other services and taxes. Verify Mumbai pricing rather than treating this as your bill. The code's daily quota is per workspace, not an account-wide financial hard cap. Restrict pilot signup/invites operationally and set concurrency/throttling to constrain abuse.

Official pricing: https://aws.amazon.com/cognito/pricing/ · https://aws.amazon.com/textract/pricing/ · https://aws.amazon.com/dynamodb/pricing/on-demand/ · https://aws.amazon.com/s3/pricing/ · https://aws.amazon.com/lambda/pricing/ · https://aws.amazon.com/api-gateway/pricing/ · https://aws.amazon.com/sqs/pricing/ · https://aws.amazon.com/sns/pricing/ · https://aws.amazon.com/eventbridge/pricing/ · https://aws.amazon.com/ses/pricing/ · https://aws.amazon.com/cloudwatch/pricing/

## 1. Cognito and frontend config

Create a user pool in Mumbai with email sign-in, required email attribute, email verification, password recovery and a suitable password policy. Use Lite with its classic hosted UI or Essentials if you want managed-login styling; avoid Plus and paid security add-ons for this test. Confirm the tier in the console before creation. Use Cognito's test email sender only within its quota; configure SES for real users. No SMS configuration is needed.

Create a **public app client with no secret**. Enable authorization code grant, PKCE S256, and scopes `openid email aws.cognito.signin.user.admin`. The last scope is required because the API uses Cognito GetUser to obtain a currently verified email and reject revoked tokens. Do not use machine-to-machine/client credentials. Set access token lifetime to 5 minutes for the pilot. This implementation deliberately does not retain/use refresh tokens: after expiry the user signs in again (hosted SSO can make this quick). That is a documented pilot UX limitation, not silent token refresh.

Allowed callbacks: `http://localhost:3000/auth/callback`, `http://127.0.0.1:3000/auth/callback` for development, and exactly `https://YOUR_FRONTEND/auth/callback` for production. Allowed sign-out URLs: corresponding `/login` URLs. Remove local callbacks in a production-only client. Set a Cognito hosted domain.

Frontend environment (public identifiers, never credentials):

```
NUXT_PUBLIC_APP_MODE=aws
NUXT_PUBLIC_API_BASE=https://YOUR_API.execute-api.ap-south-1.amazonaws.com
NUXT_PUBLIC_COGNITO_DOMAIN=https://YOUR_DOMAIN.auth.ap-south-1.amazoncognito.com
NUXT_PUBLIC_COGNITO_CLIENT_ID=YOUR_PUBLIC_CLIENT_ID
```

No trailing slash on API base or Cognito domain. Rebuild after changing public config for static hosting. SPA access token is stored in per-tab sessionStorage so reload works, and is removed at logout/401; it is not an AWS access key. XSS can read it: deploy a strict CSP, no untrusted scripts, HTTPS, and consider a server-session/BFF design before production. Cognito logout clears the hosted-login cookie; a copied access token may survive until its short expiry. The backend also calls GetUser, which rejects tokens revoked at Cognito. No refresh token is retained for logout revocation in this pilot.

## 2. DynamoDB

Create one on-demand table, e.g. `invoxa-dev`, with String partition key **pk**, String sort key **sk**, and server-side encryption. No indexes required. Optional TTL attribute: `expiresAt` (local-session rows are not created in AWS). Enable point-in-time recovery only after reviewing its cost and before keeping valuable customer records.

Data records:
- `USER#<verified subject>` / `WORKSPACE`: one owner workspace and opt-in settings.
- `WS#<workspace hash>` / `INV#<uuid>`: invoice.
- `WS#<workspace hash>` / `QUOTA#<date or total>`: conditional upload reservation counter.
- `JOB#<invoice UUID>` / `JOB`: worker correlation.
- `WS#<workspace hash>` / `REMINDER#YYYY-MM-DD`: daily mail claim/result.

Writes use optimistic versions. The reminder function scans only for workspace records (with paginated results), then queries invoices for each opted-in owner. This is intentionally a small-pilot implementation. At larger scale replace that scan with an indexed schedule/queue. Account-wide roles do not replace application tenant checks.

## 3. S3

Create a private bucket in the same region; enable all Block Public Access settings, Bucket owner enforced, default SSE-S3 encryption, and deny non-TLS access. Do not enable public website hosting on this bucket.

Set browser CORS with exact frontend origins, methods POST and GET, allowed header `Content-Type`, and exposed `ETag`. Add loopback origins only for a test environment. Bucket permission policy must never grant public read.

Enable versioning if needed for recovery; review its storage cost. Lifecycle `incoming/` objects to expire after 1 day, abort incomplete multipart uploads after 1 day, and set a policy for noncurrent versions. Do not auto-expire `documents/` originals without an explicit retention agreement.

The API signs POST grants for one key, exact byte length, type, SSE-S3 and a 120-second expiry. Completion reads and validates the bytes, then writes `documents/<workspace>/<invoice>` with `If-None-Match: *`. Incoming grants cannot overwrite the frozen original. A valid header is not a malware scan; add scanning/quarantine and a hardened document viewer before handling untrusted production documents. PDF parsing rejects password-protected, malformed and >10-page PDFs. JPEG/PNG checks are signature checks, not full image decoding.

## 4. Build and configure functions

Use a supported Node 22 runtime in Lambda (or Node 24 when offered). Locally use Node 24.11+. Run:

```
npm ci
npm test
npm run typecheck
npm run typecheck:backend
npm run build:backend
```

For each `dist/lambda/<name>/` folder, zip its **contents** so `index.cjs` is at archive root. Handler is **index.handler**. Do not upload the whole repository or `.env` files. Each bundle includes SDK dependencies.

Suggested initial settings (measure and adjust): API 1024 MB / 29 seconds; completion 512 MB / 60 seconds; reminders 256 MB / 60 seconds. Small reserved concurrency, e.g. 2 API and 1 worker/reminder, limits parallel work but is not a dollar cap. No VPC, NAT gateway or provisioned concurrency is needed.

API environment:
```
INVOXA_TABLE=...
INVOXA_BUCKET=...
COGNITO_USER_POOL_ID=...
COGNITO_CLIENT_ID=...
TEXTRACT_SNS_TOPIC_ARN=...
TEXTRACT_SNS_ROLE_ARN=...
```
Completion environment: `INVOXA_TABLE`, `TEXTRACT_SNS_TOPIC_ARN`.
Reminder environment: `INVOXA_TABLE`, `SES_FROM_EMAIL`.
AWS_REGION is provided by Lambda. Use execution roles, not access keys.

IAM permissions to configure on separate roles:
- API: DynamoDB GetItem, Query, PutItem on the table; S3 GetObject/PutObject/DeleteObject only for this bucket's `incoming/*` and `documents/*`; Textract StartExpenseAnalysis; `iam:PassRole` only the Textract SNS publishing role, conditioned on `iam:PassedToService = textract.amazonaws.com`; CloudWatch logging. GetUser uses the customer's access token, not an IAM grant.
- Completion: DynamoDB GetItem/PutItem on the table; Textract GetExpenseAnalysis; SQS ReceiveMessage/DeleteMessage/GetQueueAttributes on the completion queue; logging.
- Reminder: DynamoDB Scan/Query/GetItem/PutItem on the table; SES SendEmail scoped to the verified sender identity; logging.
- Textract publishing role: trust textract.amazonaws.com with appropriate SourceAccount/SourceArn confused-deputy conditions; allow sns:Publish only to the completion topic.
- SNS topic/queue policies: only expected services/account/topic may publish/send. See AWS SNS/SQS and Textract docs for the exact service principals and conditions.
- Scheduler execution role: lambda:InvokeFunction only the reminder function; no database or mail permissions.

Some Textract actions require wildcard resource permissions. Scope region/account with supported conditions and separate roles. Review generated policies rather than attaching AdministratorAccess.

## 5. API Gateway HTTP API

Use the default stage with auto-deploy, or include your named stage in API_BASE. Add `ANY /{proxy+}` integrated with API Lambda; no Lambda Function URL. Configure a JWT authorizer with the user-pool issuer and public client ID audience. Require `aws.cognito.signin.user.admin` scope on protected routes (the Lambda also checks `token_use=access` and verifies the token itself). The only public authentication flow is Cognito; local `/auth/signup` and `/auth/login` are not AWS API endpoints.

Configure CORS centrally on API Gateway: exact frontend origins; methods GET, POST, PATCH, OPTIONS; headers Authorization, Content-Type; credentials false. Ensure OPTIONS preflight is unauthenticated. Configure route/stage throttles conservatively (e.g. 5 requests/sec, burst 10 for a personal test) and test upload completion within timeout. Access logs must omit tokens, request bodies and file contents.

## 6. Textract completion

Create a standard SNS topic (name beginning with `AmazonTextract`, following Textract guidance), a standard SQS completion queue, and a dead-letter queue. Subscribe the queue to the SNS topic with **raw message delivery disabled**: the worker validates the SNS envelope TopicArn. Restrict queue policy to this topic. Configure the queue redrive policy, e.g. maxReceiveCount 5. Set queue visibility timeout at least six times worker timeout. Attach completion Lambda via event source mapping with **ReportBatchItemFailures** enabled. Create a DLQ depth alarm.

Textract produces suggestions only. The completion worker maps standard expense fields for supplier, invoice number, invoice/due dates, subtotal, tax, total, INR currency, vendor address/tax ID and available line items. It stores confidence scores and adds fields below 90% to `reviewFields`; missing required values are also highlighted. Dates are normalized conservatively and foreign currency is blocked for review because this pilot stores INR only. The worker then checks supplier + invoice number + total against the workspace and links a possible duplicate. A manual confirmation takes precedence over a late OCR result. No automatic retry of failed extraction is exposed, preventing repeated per-page charges; manual entry is always available after a valid upload. Inspect failed jobs / DLQ to recover genuine failures.

## 7. Optional email reminders

Verify SES sender; in SES sandbox also verify test recipients. Request production access only when ready. Create one EventBridge Scheduler daily schedule, e.g. 09:00 **Asia/Kolkata**, target reminder Lambda, flexible window off, and configure retry/DLQ behavior.

Delivery is opt-in to the verified account email; no supplier emails. A workspace/date is claimed before mail is sent to avoid duplicates on retries. An ambiguous failure leaves a `claimed` record and needs operator review; no automatic resend (it could duplicate an already sent email). Do not blindly delete claims. Configure alarms on Lambda errors. Local mode previews but never sends mail.

## 8. Frontend hosting

`npm run build` builds Nuxt. For static hosting use `npx nuxt generate` with AWS public environment set, publish only `.output/public`, and configure SPA fallback to `index.html` for routes including `/auth/callback`. Serve over HTTPS. Do not deploy local API/data to public hosting. Local API code rejects AWS mode and non-loopback hosts, and rejects production mode unless explicitly enabled for a loopback test.

Production headers: CSP appropriate to your exact API, Cognito and S3 origins; `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; `img-src 'self' blob:`; allow `frame-src blob:` for PDF preview; X-Content-Type-Options nosniff; Referrer-Policy no-referrer. Test the built bundle before tightening script/style CSP (Nuxt may need hashes/nonces for its bootstrap); do not use a broad wildcard policy as a substitute.

## AWS acceptance gate (not performed locally)

1. Complete hosted signup, email verification, login, expired-session re-login and logout.
2. Create two users/workspaces; tamper with invoice IDs on GET/PATCH/action/document/complete. All cross-tenant access must fail.
3. Upload a real representative English INR PDF and a photo; confirm the frozen original is accessible only via authorized short-lived links.
4. Attempt wrong size/type, expired POST, incoming replay, incomplete upload and >10 pages. No unauthorized extraction or cross-tenant access.
5. Verify completion SNS → SQS, every mapped field and confidence score, low-confidence highlighting, editable corrections, supplier/number/amount duplicate detection, manual review during processing, duplicate message delivery and DLQ behavior.
6. Confirm totals against a known invoice set, archived exclusion, date boundaries and optimistic-write conflicts.
7. Test SES only with consenting test addresses: opt-in, no duplicates, paid exclusion, unsubscribe, failure alarm.
8. Check CloudWatch for leaks, underlying usage costs, lifecycle behavior, backup restore, CSP and rate limits.

Do not label the application production-ready until this gate and representative customer document testing pass.
