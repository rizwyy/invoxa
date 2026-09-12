import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { DynamoRepository } from '../adapters/dynamo'
import { runReminders } from '../reminders'
const ses = new SESv2Client({})
export async function handler() {
  const from = process.env.SES_FROM_EMAIL
  if (!from) throw new Error('SES_FROM_EMAIL is required')
  const result = await runReminders(new DynamoRepository(), { async send(to, subject, text) { await ses.send(new SendEmailCommand({ FromEmailAddress: from, Destination: { ToAddresses: [to] }, Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Text: { Data: text, Charset: 'UTF-8' } } } } })) } })
  console.info(JSON.stringify({ event: 'reminder_run', ...result })); return result
}
