import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import * as readline from "readline";

const USERS_TABLE = "EXP_agents";

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

const raw = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function ensureTable() {
  try {
    await raw.send(new DescribeTableCommand({ TableName: USERS_TABLE }));
    console.log(`Table "${USERS_TABLE}" already exists.`);
  } catch {
    console.log(`Creating table "${USERS_TABLE}"...`);
    await raw.send(new CreateTableCommand({
      TableName: USERS_TABLE,
      AttributeDefinitions: [{ AttributeName: "email", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }));
    console.log(`Table "${USERS_TABLE}" created.`);
  }
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY env vars.");
    process.exit(1);
  }

  await ensureTable();

  const name = await prompt("Your name: ");
  const email = await prompt("Your email: ");
  const phone = await prompt("Your phone (optional, press enter to skip): ");
  const password = await prompt("Password: ");

  if (!name || !email || !password) {
    console.error("Name, email, and password are required.");
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 12);

  await client.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      email: email.toLowerCase(),
      password_hash,
      name,
      phone: phone || undefined,
      role: "admin",
      created_at: new Date().toISOString(),
    },
  }));

  console.log(`\nAdmin agent created: ${name} <${email}>`);
}

main().catch(err => { console.error(err); process.exit(1); });
