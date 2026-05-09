/**
 * One-time backfill: set responsible_agent_email and responsible_agent_id
 * on all existing Customers records.
 *
 * Run: npx ts-node src/scripts/backfill-responsible-agent.ts
 * Requires: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in env
 */
import { scanCustomers, updateCustomer } from "../lib/dynamodb";

const AGENT_EMAIL = "jeroen.hoppe@exp.uk.com";
const AGENT_ID = "6591cd78-beec-4cda-89e3-0e2e8ff3acf9";

async function main() {
  const customers = await scanCustomers();
  console.log(`Found ${customers.length} customers. Updating...`);

  let updated = 0;
  let failed = 0;

  for (const customer of customers) {
    try {
      await updateCustomer(customer.customer_id, {
        responsible_agent_email: AGENT_EMAIL,
        responsible_agent_id: AGENT_ID,
      });
      updated++;
      console.log(`✓ ${customer.customer_id}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${customer.customer_id}:`, err);
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
