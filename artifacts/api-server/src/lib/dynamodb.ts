import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
export const CUSTOMERS_TABLE = "Customers";
export const CONVERSATIONS_TABLE = "Conversations";
export const USERS_TABLE = "EXP_agents";

function createClient() {
  const client = new DynamoDBClient({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export function getDynamoClient() {
  return createClient();
}

export interface DynamoCustomer {
  customer_id: string;
  contact_name?: string;
  created_at?: string;
  email?: string;
  enquiry_bedrooms?: number;
  enquiry_max_price?: number;
  enquiry_postcode?: string;
  enquiry_prop_type?: string;
  lead_intent?: string;
  property_in_mind?: string;
  scraped_listings?: string;
  status?: string;
  summary?: string;
  tags?: string[];
  updated_at?: string;
  phone?: string;
}

export async function scanCustomers(): Promise<DynamoCustomer[]> {
  const client = getDynamoClient();
  const results: DynamoCustomer[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const cmd = new ScanCommand({
      TableName: CUSTOMERS_TABLE,
      ExclusiveStartKey: lastKey,
    });
    const resp = await client.send(cmd);
    if (resp.Items) {
      results.push(...(resp.Items as DynamoCustomer[]));
    }
    lastKey = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return results;
}

export async function getCustomer(customerId: string): Promise<DynamoCustomer | null> {
  const client = getDynamoClient();
  const resp = await client.send(
    new GetCommand({ TableName: CUSTOMERS_TABLE, Key: { customer_id: customerId } })
  );
  return (resp.Item as DynamoCustomer) ?? null;
}

export async function putCustomer(item: DynamoCustomer): Promise<void> {
  const client = getDynamoClient();
  await client.send(new PutCommand({ TableName: CUSTOMERS_TABLE, Item: item }));
}

export async function updateCustomer(
  customerId: string,
  fields: Partial<Omit<DynamoCustomer, "customer_id">>
): Promise<DynamoCustomer | null> {
  const client = getDynamoClient();
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return getCustomer(customerId);

  const now = new Date().toISOString();
  entries.push(["updated_at", now]);

  const updateExpr = "SET " + entries.map(([k], i) => `#f${i} = :v${i}`).join(", ");
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  entries.forEach(([k, v], i) => {
    names[`#f${i}`] = k;
    values[`:v${i}`] = v;
  });

  const resp = await client.send(
    new UpdateCommand({
      TableName: CUSTOMERS_TABLE,
      Key: { customer_id: customerId },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );
  return (resp.Attributes as DynamoCustomer) ?? null;
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const client = getDynamoClient();
  await client.send(new DeleteCommand({ TableName: CUSTOMERS_TABLE, Key: { customer_id: customerId } }));
}

function nonEmpty(val: string | undefined | null): string | null {
  if (!val || val.trim() === "") return null;
  return val;
}

export interface DynamoMessage {
  phone_number: string;
  message_id: string;
  message: string;
  role: string;
  timestamp: string;
}

export async function scanAllConversationsByPhone(): Promise<Record<string, DynamoMessage[]>> {
  const client = getDynamoClient();
  const grouped: Record<string, DynamoMessage[]> = {};
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await client.send(new ScanCommand({
      TableName: CONVERSATIONS_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    for (const item of (result.Items ?? []) as DynamoMessage[]) {
      if (!grouped[item.phone_number]) grouped[item.phone_number] = [];
      grouped[item.phone_number].push(item);
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return grouped;
}

export async function getMessagesByPhone(phoneNumber: string): Promise<DynamoMessage[]> {
  const client = getDynamoClient();
  const messages: DynamoMessage[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await client.send(new ScanCommand({
      TableName: CONVERSATIONS_TABLE,
      FilterExpression: "phone_number = :ph",
      ExpressionAttributeValues: { ":ph": phoneNumber },
      ExclusiveStartKey: lastKey,
    }));
    for (const item of (result.Items ?? []) as DynamoMessage[]) {
      messages.push(item);
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return messages;
}

export interface DynamoAgent {
  email: string;
  agent_id: string;
  password_hash: string;
  name: string;
  phone?: string;
  role: "agent" | "admin";
  created_at: string;
}

export async function getAgent(email: string): Promise<DynamoAgent | null> {
  const client = getDynamoClient();
  const resp = await client.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { email } })
  );
  return (resp.Item as DynamoAgent) ?? null;
}

export async function putAgent(item: DynamoAgent): Promise<void> {
  const client = getDynamoClient();
  await client.send(new PutCommand({ TableName: USERS_TABLE, Item: item }));
}

export async function listAgents(): Promise<DynamoAgent[]> {
  const client = getDynamoClient();
  const resp = await client.send(new ScanCommand({ TableName: USERS_TABLE }));
  return (resp.Items ?? []) as DynamoAgent[];
}

export function mapDynamoToContact(c: DynamoCustomer) {
  const name = nonEmpty(c.contact_name) ?? "Unknown";
  const phone = nonEmpty(c.phone) ?? nonEmpty(c.customer_id) ?? "";
  return {
    id: c.customer_id,
    name,
    email: nonEmpty(c.email),
    phone,
    tags: Array.isArray(c.tags) ? c.tags.filter(Boolean) : [],
    leadIntent: nonEmpty(c.lead_intent),
    summary: nonEmpty(c.summary),
    propertyInMind: nonEmpty(c.property_in_mind),
    bedrooms: c.enquiry_bedrooms && c.enquiry_bedrooms > 0 ? c.enquiry_bedrooms : null,
    budget: c.enquiry_max_price && c.enquiry_max_price > 0 ? `£${c.enquiry_max_price.toLocaleString()}` : null,
    enquiryPostcode: nonEmpty(c.enquiry_postcode),
    enquiryPropType: nonEmpty(c.enquiry_prop_type),
    status: nonEmpty(c.status),
    scrapedListings: nonEmpty(c.scraped_listings),
    createdAt: nonEmpty(c.created_at) ?? new Date().toISOString(),
    updatedAt: nonEmpty(c.updated_at) ?? new Date().toISOString(),
  };
}
