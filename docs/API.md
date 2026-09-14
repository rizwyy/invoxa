# Application API

Local `/api` prefix; AWS API base is configured publicly. All business endpoints require authentication. Workspace identity is derived server-side from the verified user. The one-owner model has no user-supplied workspace selector.

| Method | Path | Body / response |
| --- | --- | --- |
| GET | /me | `{user, workspace}`; workspace may be null |
| POST | /workspace | `{name}` → workspace |
| PATCH | /workspace | `{name, reminders, reminderDays, version}` |
| GET | /invoices | Complete workspace-scoped pilot list (max 1,000 reservations); frontend filters/paginates |
| GET | /invoices/:id | Invoice |
| POST | /uploads | `{name,type,size}` → `{invoice, upload:{url,fields?,method}}` |
| POST | /invoices/:id/complete | `{}` → validated invoice / processing state |
| GET | /invoices/:id/document | `{url,type}`; authenticated local URL or 60-second private S3 GET |
| PATCH | /invoices/:id | Editable fields in `shared/domain.ts`, including vendor details and line items, + `version`, `acknowledged:true`, optional `acceptDifference:true` |
| POST | /invoices/:id/action | `{action:paid|unpaid|archive|restore,version}` |
| GET | /summary | Confirmed active record totals |
| GET | /reminders/preview | Saved settings + qualifying invoices; does not send mail |

Money is integer paise, currency INR. Dates are YYYY-MM-DD with no timezone; due date can be empty. Timestamps are UTC. Overdue/due-soon computations use the current India calendar date. Dashboard monthly values use invoice date, not paid date. A reviewed record can be paid/unpaid; due statuses are derived. Invoice version increments on every write. A 409 means reload and reconcile rather than retrying an old body blindly.

Local-only auth: POST /auth/signup and /auth/login with email/password; HTTP-only opaque session cookie; POST /auth/logout deletes session. No password reset or verification email in local mode. Local upload PUT /local-upload/:id and GET /local-file/:id require that session. Local mutation requests must include the matching Origin and Content-Length. This adapter supports one local process only; do not share its data directory between processes.

AWS auth: Authorization Bearer access token. API Gateway JWT authorizer plus independent Cognito JWT signature/issuer/client/token-use checks in Lambda and GetUser email verification. Invalid/expired credentials → 401; no workspace → 403; other-tenant or nonexistent invoice → 404; invalid body → 400; conflict → 409; quota → 429.

Original file reference, workspace ID, review status and extraction metadata are server-controlled. PATCH parses only allowed editable fields. CSV neutralizes formula prefixes. Permanent deletion requires a future retention workflow; archiving is reversible and keeps originals.

AWS extraction metadata includes `source`, per-field `confidence`, `reviewFields`, user-facing `warnings`, and `completedAt`. A field enters `reviewFields` when confidence is below 90% or a required value was not found. Line items carry description, optional quantity, optional unit price, optional row amount and confidence. `duplicate` points to another invoice when the file hash matches or when normalized supplier + invoice number + total all match. These flags inform review; they do not silently reject or overwrite a record.
