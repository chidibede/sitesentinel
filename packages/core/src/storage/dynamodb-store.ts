/**
 * DynamoDB Issue Store for AWS Lambda
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { IssueStore, Issue, IssueStatus, AuditEntry } from '../agent/issue-manager.js';

export class DynamoDBIssueStore implements IssueStore {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    const dynamoClient = new DynamoDBClient({});
    this.client = DynamoDBDocumentClient.from(dynamoClient);
  }

  async create(issue: Issue): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: issue,
      })
    );
  }

  async get(id: string): Promise<Issue | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { id },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as Issue;
  }

  async list(filters?: {
    siteId?: string;
    status?: IssueStatus;
    zone?: string;
  }): Promise<Issue[]> {
    if (filters?.siteId) {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'bySite',
          KeyConditionExpression: 'siteId = :siteId',
          ExpressionAttributeValues: {
            ':siteId': filters.siteId,
          },
          ScanIndexForward: false,
        })
      );

      let items = (result.Items as Issue[] | undefined) ?? [];

      if (filters.status) {
        items = items.filter((i) => i.status === filters.status);
      }

      if (filters.zone) {
        items = items.filter((i) => i.zone === filters.zone);
      }

      return items;
    }

    if (filters?.status) {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'byStatus',
          KeyConditionExpression: 'status = :status',
          ExpressionAttributeValues: {
            ':status': filters.status,
          },
          ScanIndexForward: false,
        })
      );

      let items = (result.Items as Issue[] | undefined) ?? [];

      if (filters.zone) {
        items = items.filter((i) => i.zone === filters.zone);
      }

      return items;
    }

    throw new Error('List operation requires at least siteId or status filter');
  }

  async update(id: string, updates: Partial<Issue>): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {};
    const expressionAttributeNames: Record<string, string> = {};

    let idx = 0;
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id') continue;

      const valueKey = `:val${idx}`;
      const nameKey = `#name${idx}`;

      updateExpressions.push(`${nameKey} = ${valueKey}`);
      expressionAttributeValues[valueKey] = value;
      expressionAttributeNames[nameKey] = key;

      idx++;
    }

    if (updateExpressions.length === 0) {
      return;
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      })
    );
  }

  async addAuditEntry(id: string, entry: AuditEntry): Promise<void> {
    const issue = await this.get(id);
    if (!issue) {
      throw new Error(`Issue ${id} not found`);
    }

    issue.auditTrail.push(entry);
    issue.updatedAt = new Date().toISOString();

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: issue,
      })
    );
  }
}
