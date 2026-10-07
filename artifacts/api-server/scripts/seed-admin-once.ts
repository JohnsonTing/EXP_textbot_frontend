import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";

const USERS_TABLE = "EXP_agents";
const CUSTOMERS_TABLE = "Customers";

const AGENT = {
  email: "jeroen.hoppe@exp.uk.com",
  name: "jeroen.hoppe@exp.uk.com",
  phone: "+44 7837 093554",
  password: "12345678",
  role: "admin" as const,
};

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const client = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

async function ensureTable() {
  try {
    await rawClient.send(new DescribeTableCommand({ TableName: USERS_TABLE }));
    console.log(`Table "${USERS_TABLE}" exists.`);
  } catch {
    console.log(`Creating table "${USERS_TABLE}"...`);
    await rawClient.send(new CreateTableCommand({
      TableName: USERS_TABLE,
      AttributeDefinitions: [{ AttributeName: "email", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }));
    console.log(`Table "${USERS_TABLE}" created.`);
  }
}

async function createAgent() {
  const password_hash = await bcrypt.hash(AGENT.password, 12);
  await client.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      email: AGENT.email,
      password_hash,
      name: AGENT.name,
      phone: AGENT.phone,
      role: AGENT.role,
      created_at: new Date().toISOString(),
    },
  }));
  console.log(`Agent created: ${AGENT.name} <${AGENT.email}>`);
}

async function associateCustomers() {
  console.log("Scanning Customers table...");
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const resp = await client.send(new ScanCommand({
      TableName: CUSTOMERS_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...((resp.Items ?? []) as Record<string, unknown>[]));
    lastKey = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log(`Updating ${items.length} customer records with agent_email...`);
  for (const item of items) {
    await client.send(new UpdateCommand({
      TableName: CUSTOMERS_TABLE,
      Key: { customer_id: item.customer_id },
      UpdateExpression: "SET agent_email = :ae",
      ExpressionAttributeValues: { ":ae": AGENT.email },
    }));
  }
  console.log("All customers associated.");
}

async function main() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("Missing AWS credentials in env.");
    process.exit(1);
  }

  await ensureTable();
  await createAgent();
  await associateCustomers();

  console.log("\nDone. Login with:");
  console.log(`  Email:    ${AGENT.email}`);
  console.log(`  Password: ${AGENT.password}`);
}

main().catch(err => { console.error(err); process.exit(1); });
