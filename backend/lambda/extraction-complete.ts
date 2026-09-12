import type { SQSHandler } from 'aws-lambda'
import { TextractClient, GetExpenseAnalysisCommand, type ExpenseDocument } from '@aws-sdk/client-textract'
import { DynamoRepository } from '../adapters/dynamo'
import { normalizeExpense } from '../extraction'
import { Conflict } from '../repository'
import type { Invoice } from '../../shared/domain'
const client = new TextractClient({})
export const handler: SQSHandler = async event => {
  const repo = new DynamoRepository(); const batchItemFailures: { itemIdentifier: string }[] = []
  for (const record of event.Records) {
    try {
      const envelope = JSON.parse(record.body)
      if (envelope.TopicArn !== process.env.TEXTRACT_SNS_TOPIC_ARN || !envelope.Message) throw new Error('Unexpected notification source')
      const message = JSON.parse(envelope.Message)
      if (message.API !== 'StartExpenseAnalysis' || typeof message.JobTag !== 'string') continue
      const mapping = await repo.get(`JOB#${message.JobTag}`, 'JOB')
      if (!mapping) throw new Error('Job mapping is not available')
      const row = await repo.get(`WS#${mapping.data.workspaceId}`, `INV#${mapping.data.invoiceId}`)
      if (!row) continue
      const invoice = row.data as Invoice
      if (invoice.reviewed || invoice.processing !== 'processing') continue
      if (invoice.jobId && invoice.jobId !== message.JobId) throw new Error('Job ID mismatch')
      if (message.Status !== 'SUCCEEDED') {
        invoice.processing = 'failed'; invoice.failure = 'Extraction failed. Enter the invoice details manually.'
      } else {
        const documents: ExpenseDocument[] = []; let next: string | undefined
        do { const result = await client.send(new GetExpenseAnalysisCommand({ JobId: message.JobId, NextToken: next })); documents.push(...result.ExpenseDocuments || []); next = result.NextToken } while (next)
        const extracted = normalizeExpense(documents)
        Object.assign(invoice, extracted.fields)
        invoice.extraction = { source: 'textract', confidence: extracted.confidence, warnings: [...invoice.extraction?.warnings || [], ...extracted.warnings] }
        invoice.processing = 'needs-review'
      }
      invoice.version++; invoice.updatedAt = new Date().toISOString(); invoice.jobId = message.JobId
      await repo.put({ ...row, version: invoice.version, data: invoice }, row.version)
    } catch (e) {
      // A concurrent manual confirmation wins over OCR. Other conflicts are safe to retry.
      batchItemFailures.push({ itemIdentifier: record.messageId })
      if (!(e instanceof Conflict)) console.error(JSON.stringify({ event: 'extraction_completion_failure', messageId: record.messageId, errorType: e instanceof Error ? e.name : 'unknown' }))
    }
  }
  return { batchItemFailures }
}
