import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { Conflict, type Repository, type RecordItem } from '../repository'
export class DynamoRepository implements Repository {
  client = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })
  constructor(public table = process.env.INVOXA_TABLE || '') { if (!table) throw new Error('INVOXA_TABLE is required') }
  async get(pk: string, sk: string) { return (await this.client.send(new GetCommand({ TableName: this.table, Key: { pk, sk }, ConsistentRead: true }))).Item as RecordItem | undefined }
  async list(pk: string, prefix: string) {
    const records: RecordItem[] = []; let cursor: any
    do { const page = await this.client.send(new QueryCommand({ TableName: this.table, KeyConditionExpression: 'pk = :p AND begins_with(sk, :s)', ExpressionAttributeValues: { ':p': pk, ':s': prefix }, ExclusiveStartKey: cursor, ConsistentRead: true })); records.push(...page.Items as RecordItem[] || []); cursor = page.LastEvaluatedKey } while (cursor)
    return records
  }
  async workspaces() {
    const records: RecordItem[] = []; let cursor: any
    do { const page = await this.client.send(new ScanCommand({ TableName: this.table, FilterExpression: 'sk = :s', ExpressionAttributeValues: { ':s': 'WORKSPACE' }, ExclusiveStartKey: cursor })); records.push(...page.Items as RecordItem[] || []); cursor = page.LastEvaluatedKey } while (cursor)
    return records
  }
  async put(item: RecordItem, expected?: number) {
    try { await this.client.send(new PutCommand({ TableName: this.table, Item: item, ConditionExpression: expected === 0 ? 'attribute_not_exists(pk)' : expected !== undefined ? '#v = :v' : undefined, ExpressionAttributeNames: expected && expected > 0 ? { '#v': 'version' } : undefined, ExpressionAttributeValues: expected && expected > 0 ? { ':v': expected } : undefined })) } catch (e: any) { if (e.name === 'ConditionalCheckFailedException') throw new Conflict(); throw e }
  }
  async remove(pk: string, sk: string) { await this.client.send(new DeleteCommand({ TableName: this.table, Key: { pk, sk } })) }
}
