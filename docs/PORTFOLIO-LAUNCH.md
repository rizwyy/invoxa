# Invoxa portfolio launch pack

## One-line description

Invoxa is an invoice management workspace for Indian small businesses that turns scattered supplier bills into reviewed, searchable records with clear payment status.

## Portfolio description

Invoxa is a full-stack supplier-invoice workflow built with Nuxt, Vue, TypeScript and Tailwind CSS. Users can create a workspace, upload PDF or image invoices, review and correct invoice data, confirm records, track paid and overdue bills, search and filter invoices, archive records, export CSV files and monitor dashboard totals.

The local application includes persistent accounts, isolated workspaces, protected file previews, validation, optimistic updates and reminder previews. The repository also includes deployable AWS Lambda adapters for Cognito authentication, API Gateway, DynamoDB, private S3 storage, Textract extraction, SNS/SQS processing and SES reminders. The local workflow is tested; live AWS deployment and customer validation remain separate release steps.

## Short project card

**Invoxa — Supplier invoice management workspace**

Full-stack Nuxt application for uploading, reviewing, organizing and tracking supplier invoices. Includes persistent local accounts, isolated workspaces, protected document previews, payment tracking, search, filters, CSV export and dashboard reporting, with AWS integration adapters prepared for deployment.

## LinkedIn post

I built Invoxa, a full-stack supplier-invoice management workspace for Indian small businesses.

The project addresses a simple operational problem: invoices are often scattered across inboxes and folders, while due dates and payment status are tracked manually.

With Invoxa, a user can:

- Upload PDF, JPEG or PNG supplier invoices
- Review and correct invoice information before confirming it
- Track paid, unpaid, overdue and due-soon invoices
- Search, filter, archive and export invoice records
- View outstanding amounts, monthly totals and supplier summaries

I built the application with Nuxt, Vue, TypeScript and Tailwind CSS. It includes a persistent local backend, account and workspace isolation, protected file previews, validation and automated tests. I also prepared separate AWS adapters for Cognito, API Gateway, Lambda, DynamoDB, S3, Textract, SNS/SQS and SES.

The local core workflow is complete and tested. AWS deployment and validation with real customer documents are the next stages.

Repository: https://github.com/rizwyy/invoxa

#Nuxt #VueJS #TypeScript #AWS #SaaS #WebDevelopment

## Recommended screenshots

1. Before-and-after comparison graphic.
2. Overview dashboard with synthetic totals.
3. Upload screen with the supplied synthetic invoice selected.
4. Review screen showing the source document and editable fields.
5. Invoice list with payment-status filters.

Do not include real customer invoices, email addresses, AWS identifiers, tokens or account details.

## 60-second demo script

1. “Small businesses often receive supplier invoices through different inboxes and folders, then track payment manually.”
2. “Invoxa brings that workflow into one workspace.”
3. Upload the synthetic sample invoice and show its protected preview.
4. Enter or review the invoice fields and confirm the record.
5. Show the invoice in the searchable list and mark it paid.
6. Return to the dashboard and show how the outstanding balance changes.
7. “The local core workflow is complete and tested. AWS deployment adapters are prepared for authentication, private storage, automated extraction and reminders.”

## Evidence

- 12 core automated tests pass.
- Frontend and backend TypeScript checks pass.
- Nuxt production build passes.
- Three AWS Lambda bundles build successfully.
- Local browser testing covers signup, workspace creation, upload, preview, review, confirmation and dashboard updates.

These checks support the portfolio claim that the local full-stack workflow works. They do not prove live AWS operation, OCR accuracy on customer documents or customer demand.
