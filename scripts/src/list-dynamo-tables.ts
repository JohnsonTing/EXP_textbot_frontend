import { DynamoDBClient, ListTablesCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand as DocScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const tables = await client.send(new ListTablesCommand({}));
console.log("Tables:", JSON.stringify(tables.TableNames, null, 2));

for (const table of tables.TableNames ?? []) {
  const result = await docClient.send(new DocScanCommand({
    TableName: table,
    Limit: 1,
  }));
  const item = result.Items?.[0];
  if (item) {
    console.log(`\n--- ${table} (${result.Count} sampled, ~${result.ScannedCount} total) ---`);
    console.log("Keys:", Object.keys(item));
    console.log("Sample:", JSON.stringify(item, null, 2).substring(0, 800));
  }
}
