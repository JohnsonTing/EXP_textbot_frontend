import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const USERS_TABLE = "EXP_agents";
const CUSTOMERS_TABLE = "Customers";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  }),
  { marshallOptions: { removeUndefinedValues: true } }
);

async function migrateAgents(): Promise<Map<string, string>> {
  // email -> agent_id
  const emailToId = new Map<string, string>();

  const resp = await client.send(new ScanCommand({ TableName: USERS_TABLE }));
  const agents = (resp.Items ?? []) as Record<string, string>[];

  for (const agent of agents) {
    if (agent.agent_id) {
      console.log(`Agent ${agent.email} already has agent_id: ${agent.agent_id}`);
      emailToId.set(agent.email, agent.agent_id);
      continue;
    }
    const id = uuidv4();
    await client.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { email: agent.email },
      UpdateExpression: "SET agent_id = :id",
      ExpressionAttributeValues: { ":id": id },
    }));
    console.log(`Assigned agent_id ${id} to ${agent.email}`);
    emailToId.set(agent.email, id);
  }

  return emailToId;
}

async function migrateCustomers(emailToId: Map<string, string>) {
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

  console.log(`Migrating ${items.length} customer records...`);

  for (const item of items) {
    const agentEmail = item.agent_email as string | undefined;
    const agentId = agentEmail ? emailToId.get(agentEmail) : undefined;

    await client.send(new UpdateCommand({
      TableName: CUSTOMERS_TABLE,
      Key: { customer_id: item.customer_id },
      UpdateExpression: "SET agent_id = :aid REMOVE agent_email",
      ExpressionAttributeValues: { ":aid": agentId ?? "unassigned" },
    }));
  }

  console.log("Customers migrated: agent_email removed, agent_id set.");
}

async function main() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("Missing AWS credentials.");
    process.exit(1);
  }

  const emailToId = await migrateAgents();
  await migrateCustomers(emailToId);
  console.log("\nMigration complete.");
}

main().catch(err => { console.error(err); process.exit(1); });
