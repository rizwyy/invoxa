# Validation record

## Passed during implementation

- Core automated tests cover exact currency conversion, invalid dates, due-date boundaries, unconfirmed/archived exclusion, workspace isolation across invoice/file/edit/action routes, persistent storage, immutable originals, review acknowledgement, stale writes, paid/archive/restore behavior, malformed/oversized/multipage PDF rejection, hashed passwords, session persistence/logout, concurrent upload guards, conservative OCR normalization, vendor details and line-item extraction, low-confidence review flags, supplier/number/amount duplicate detection, reminder opt-in/deduplication, CSV formula escaping and failed-document safeguards.
- HTTP smoke: signup → workspace → upload → complete → review/save → authenticated PDF → logout. No-session file access and cross-origin mutation rejected.
- Browser: test-account login, workspace creation, empty dashboard, PDF selection/upload, actual PDF preview, manual review form, confirmation/list state and ₹49,560 dashboard update.
- Frontend and backend TypeScript checks passed. Final Nuxt production build and backend bundles passed after the hardening edits. ZIP integrity checks passed.
- Three Lambda bundles and ZIP archives were generated. They have not been deployed.

## Still requires verification

- Browser visual checks cover the public homepage, upgraded upload screen, searchable invoice list, original-document review layout and editable line-item controls at the current desktop/responsive viewport. Payment, archive/restore and settings interactions still need a final browser pass; backend behavior is covered by automated tests.
- Real Cognito signup/verification/recovery, callbacks, expiration/logout, Gateway authorizer/CORS, DynamoDB IAM and consistency, S3 policy/lifecycle, Textract SNS/SQS completion and DLQ, SES/scheduler, regional pricing and budgets.
- OCR accuracy, the initial 90% review threshold and correction time on consenting customers' representative invoice formats, particularly dates, GST, line items, poor scans and language coverage.
- Production malware scanning, CSP/security review, backup recovery and data-retention/deletion rules.

Browser testing created `ui-test@example.test` and an Invoxa Test Studio workspace locally, plus synthetic smoke-test accounts. These are test fixtures, not real customer accounts. Create your own test account for normal use.
