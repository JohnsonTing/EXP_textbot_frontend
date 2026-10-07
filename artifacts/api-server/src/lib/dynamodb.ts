import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
// Live tables by default. TABLE_SUFFIX=-dev points the dashboard at the bot's
// dev stack (Customers-dev, Conversations-dev, ...) for testing.
const TABLE_SUFFIX = process.env.TABLE_SUFFIX || "";
export const CUSTOMERS_TABLE = `Customers${TABLE_SUFFIX}`;
export const CONVERSATIONS_TABLE = `Conversations${TABLE_SUFFIX}`;
export const AGENTS_TABLE = `EXP_agents${TABLE_SUFFIX}`;
export const METRICS_TABLE = `EXP_agent_metrics${TABLE_SUFFIX}`;

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
  "First Name"?: string;
  "Last Name"?: string;
  contact_name?: string;
  created_at?: string;
  email?: string;
  enquiry_bedrooms?: number;
  enquiry_max_price?: number;
  enquiry_postcode?: string;
  enquiry_prop_type?: string;
  lead_intent?: string;
  customer_type?: string;
  bot_paused?: boolean;
  property_in_mind?: string;
  responsible_agent_email?: string;
  responsible_agent_id?: string;
  responsible_agent_name?: string;
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
  entries.forEach(([key, v], i) => {
    names[`#f${i}`] = key;
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

export interface DynamoAgent {
  agent_id: string;
  email: string;
  password_hash: string;
  name: string;
  phone?: string;
  role: "agent" | "admin";
  created_at: string;
}

export async function getAgentByEmail(email: string): Promise<DynamoAgent | null> {
  const client = getDynamoClient();
  const resp = await client.send(new ScanCommand({
    TableName: AGENTS_TABLE,
    FilterExpression: "email = :email",
    ExpressionAttributeValues: { ":email": email },
  }));
  return (resp.Items?.[0] as DynamoAgent) ?? null;
}

export async function putAgent(item: DynamoAgent): Promise<void> {
  const client = getDynamoClient();
  await client.send(new PutCommand({ TableName: AGENTS_TABLE, Item: item }));
}

export async function listAgents(): Promise<DynamoAgent[]> {
  const client = getDynamoClient();
  const resp = await client.send(new ScanCommand({ TableName: AGENTS_TABLE }));
  return (resp.Items ?? []) as DynamoAgent[];
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
  // Set by the bot from 2026-09: 'customer' | 'chloe' | 'agent'. Older rows lack it.
  sender?: string;
  sender_agent_id?: string;
  sender_name?: string;
  // Email rows (bot's email channel). SMS rows have no channel field.
  channel?: string;
  direction?: string;
  email_from?: string;
  email_subject?: string;
  email_cc?: string[];
  email_action?: string;
  thread_key?: string;
}

// The bot keys every message by the customer's phone when it has one, so texts
// and emails with the same person land in one conversation. A lead with no
// phone is keyed "email:<address>".
export const EMAIL_KEY_PREFIX = "email:";

export function messageChannel(m: Pick<DynamoMessage, "channel">): "sms" | "email" {
  return m.channel === "email" ? "email" : "sms";
}

export function conversationKey(c: DynamoCustomer): string | null {
  if (c.phone) return c.phone;
  return c.email ? `${EMAIL_KEY_PREFIX}${c.email.trim().toLowerCase()}` : null;
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

export function buildCustomerName(c: DynamoCustomer): string {
  const first = c["First Name"]?.trim() ?? "";
  const last = c["Last Name"]?.trim() ?? "";
  const combined = [first, last].filter(Boolean).join(" ");
  return combined || c.contact_name?.trim() || "Unknown";
}

export function mapDynamoToContact(c: DynamoCustomer) {
  const name = buildCustomerName(c);
  const phone = nonEmpty(c.phone) ?? "";
  return {
    id: c.customer_id,
    name,
    email: nonEmpty(c.email),
    phone,
    tags: Array.isArray(c.tags) ? c.tags.filter(Boolean) : [],
    leadIntent: nonEmpty(c.lead_intent),
    customerType: nonEmpty(c.customer_type),
    summary: nonEmpty(c.summary),
    propertyInMind: nonEmpty(c.property_in_mind),
    bedrooms: c.enquiry_bedrooms && c.enquiry_bedrooms > 0 ? c.enquiry_bedrooms : null,
    budget: c.enquiry_max_price && c.enquiry_max_price > 0 ? `£${c.enquiry_max_price.toLocaleString()}` : null,
    enquiryPostcode: nonEmpty(c.enquiry_postcode),
    enquiryPropType: nonEmpty(c.enquiry_prop_type),
    status: nonEmpty(c.status),
    scrapedListings: nonEmpty(c.scraped_listings),
    responsibleAgentEmail: nonEmpty(c.responsible_agent_email),
    responsibleAgentId: nonEmpty(c.responsible_agent_id),
    botPaused: c.bot_paused ?? false,
    createdAt: nonEmpty(c.created_at) ?? new Date().toISOString(),
    updatedAt: nonEmpty(c.updated_at) ?? new Date().toISOString(),
  };
}
