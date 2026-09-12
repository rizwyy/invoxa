import { TextractClient, StartExpenseAnalysisCommand } from '@aws-sdk/client-textract'
import type { Invoice } from '../../shared/domain'
export class TextractExtractor {
  client = new TextractClient({})
  async start(invoice: Invoice) {
    const Bucket = process.env.INVOXA_BUCKET; const SNSTopicArn = process.env.TEXTRACT_SNS_TOPIC_ARN; const RoleArn = process.env.TEXTRACT_SNS_ROLE_ARN
    if (!Bucket || !SNSTopicArn || !RoleArn) throw new Error('Textract configuration is incomplete')
    const result = await this.client.send(new StartExpenseAnalysisCommand({ DocumentLocation: { S3Object: { Bucket, Name: invoice.file!.key } }, ClientRequestToken: invoice.id, JobTag: invoice.id, NotificationChannel: { SNSTopicArn, RoleArn } }))
    if (!result.JobId) throw new Error('Textract returned no job ID'); return result.JobId
  }
}
