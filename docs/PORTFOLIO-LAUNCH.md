# Invoxa portfolio launch pack

## One-line description

Invoxa is an automated invoice-processing workspace for Indian small businesses that turns uploaded supplier bills into completed, searchable records and sends uncertain fields for human review.

## Portfolio description

Invoxa is a full-stack supplier-invoice workflow built with Nuxt, Vue, TypeScript and Tailwind CSS. Its AWS processing path sends private uploads to Textract AnalyzeExpense, normalizes supplier details, dates, GST, totals and line items, stores confidence scores, highlights uncertain fields for correction, and checks possible duplicates before confirmation. Confirmed invoices remain searchable and feed payment-status and dashboard reporting.

The local application includes persistent accounts, isolated workspaces, protected file previews, validation, optimistic updates and reminder previews. The repository also includes deployable AWS Lambda adapters for Cognito authentication, API Gateway, DynamoDB, private S3 storage, Textract extraction, SNS/SQS processing and SES reminders. The processing code and local review workflow are tested; live AWS deployment, real-document OCR testing and customer validation remain separate release steps.

## Short project card

**Invoxa — Automated supplier invoice processing**

Full-stack Nuxt application that turns uploaded supplier bills into editable records, flags low-confidence fields and possible duplicates, and tracks payment status. Includes protected previews, search, filters, CSV export and dashboard reporting, with a serverless AWS Textract processing path prepared for deployment.

## LinkedIn post

I upgraded Invoxa from an invoice organizer into an automated supplier-invoice processing workflow for Indian small businesses.

The project addresses a simple operational problem: invoices are often scattered across inboxes and folders, while due dates and payment status are tracked manually.

With Invoxa, a user can:

- Upload PDF, JPEG or PNG supplier invoices
- Use AWS Textract AnalyzeExpense to extract supplier details, dates, GST, totals and line items
- Review confidence scores and correct only the fields that need attention
- Detect possible duplicates from the supplier, invoice number and amount
- Track paid, unpaid, overdue and due-soon invoices
- Search, filter, archive and export invoice records
- View outstanding amounts, monthly totals and supplier summaries

I built the application with Nuxt, Vue, TypeScript and Tailwind CSS. It includes a persistent local backend, account and workspace isolation, protected file previews, validation and automated tests. I also prepared separate AWS adapters for Cognito, API Gateway, Lambda, DynamoDB, S3, Textract, SNS/SQS and SES.

The processing and review workflow is implemented and tested in code. AWS deployment and validation with real customer documents are the next stages.

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

- 14 core automated tests pass.
- Frontend and backend TypeScript checks pass.
- Nuxt production build passes.
- Three AWS Lambda bundles build successfully.
- Local browser testing covers signup, workspace creation, upload, preview, review, confirmation and dashboard updates.

These checks support the portfolio claim that the local full-stack workflow works. They do not prove live AWS operation, OCR accuracy on customer documents or customer demand.
