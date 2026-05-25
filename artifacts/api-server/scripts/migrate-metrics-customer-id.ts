import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const METRICS_TABLE = "EXP_agent_metrics";
const CUSTOMERS_TABLE = "Customers";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  }),
  { marshallOptions: { removeUndefinedValues: true } }
);

function isPhoneNumber(val: string): boolean {
  return /^\+?\d{7,}$/.test(val.replace(/[\s\-().]/g, ""));
}

async function fullScan(table: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const resp = await client.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
    items.push(...((resp.Items ?? []) as Record<string, unknown>[]));
    lastKey = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

async function main() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("Missing AWS credentials.");
    process.exit(1);
  }

  console.log("Scanning EXP_agent_metrics...");
  const metrics = await fullScan(METRICS_TABLE);
  console.log(`  ${metrics.length} total metric records`);

  const toFix = metrics.filter((m) => typeof m.customer_id === "string" && isPhoneNumber(m.customer_id as string));
  console.log(`  ${toFix.length} records with phone-number customer_id`);

  if (toFix.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  console.log("\nScanning Customers table...");
  const customers = await fullScan(CUSTOMERS_TABLE);
  console.log(`  ${customers.length} customers loaded`);

  // Build lookup: phone -> real customer_id
  const phoneToCustomerId = new Map<string, string>();
  for (const c of customers) {
    const cid = c.customer_id as string | undefined;
    const phone = c.phone as string | undefined;
    if (!cid) continue;
    // customer_id itself might be a phone (legacy)
    if (cid && isPhoneNumber(cid)) {
      phoneToCustomerId.set(cid, cid); // will be overwritten if real UUID found
    }
    if (phone) {
      phoneToCustomerId.set(phone, cid);
    }
  }

  // Also build UUID-keyed map to detect when customer_id is already a UUID
  const uuidCustomers = new Set(
    customers.map((c) => c.customer_id as string).filter((id) => !isPhoneNumber(id))
  );

  console.log(`\nMigrating records...`);
  let updated = 0;
  let skipped = 0;

  for (const m of toFix) {
    const phone = m.customer_id as string;
    const realId = phoneToCustomerId.get(phone);

    if (!realId) {
      console.log(`  [SKIP] No customer found for phone ${phone} (agent_id=${m.agent_id}, ts=${m.timestamp})`);
      skipped++;
      continue;
    }

    if (!uuidCustomers.has(realId)) {
      console.log(`  [SKIP] Resolved ID "${realId}" is not a UUID — customer may still be phone-keyed (phone=${phone})`);
      skipped++;
      continue;
    }

    await client.send(new UpdateCommand({
      TableName: METRICS_TABLE,
      Key: { agent_id: m.agent_id, timestamp: m.timestamp },
      UpdateExpression: "SET customer_id = :cid",
      ExpressionAttributeValues: { ":cid": realId },
    }));

    console.log(`  [OK] ${phone} -> ${realId} (agent_id=${m.agent_id}, ts=${m.timestamp})`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(err => { console.error(err); process.exit(1); });
