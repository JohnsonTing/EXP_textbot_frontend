import { Router, type IRouter } from "express";
import { getDynamoClient, CUSTOMERS_TABLE, CONVERSATIONS_TABLE, buildCustomerName, DynamoCustomer } from "../lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";

const METRICS_TABLE = "EXP_agent_metrics";

async function fullScan(tableName: string): Promise<Record<string, unknown>[]> {
  const client = getDynamoClient();
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const resp = await client.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey: lastKey }));
    items.push(...((resp.Items ?? []) as Record<string, unknown>[]));
    lastKey = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

// Metric event timestamps are composite sort keys ("<iso>#<hash>") — strip the hash for display/sorting.
function eventTimestamp(e: Record<string, unknown>): string {
  return typeof e.timestamp === "string" ? e.timestamp.split("#")[0] : "";
}

function detailListFromEvents(
  events: Record<string, unknown>[],
  customersById: Map<string, DynamoCustomer>,
  customersByPhone: Map<string, DynamoCustomer>
) {
  const latestByCustomer = new Map<string, { event: Record<string, unknown>; timestamp: string }>();
  for (const e of events) {
    const customerId = e.customer_id as string;
    if (!customerId) continue;
    const timestamp = eventTimestamp(e);
    const existing = latestByCustomer.get(customerId);
    if (!existing || timestamp > existing.timestamp) {
      latestByCustomer.set(customerId, { event: e, timestamp });
    }
  }
  return Array.from(latestByCustomer.entries())
    .map(([customerId, { event, timestamp }]) => {
      // Older metric events stored the customer's phone number as customer_id, from before the UUID migration.
      const c = customersById.get(customerId) ?? customersByPhone.get(customerId);
      return {
        customerId,
        name: c ? buildCustomerName(c) : "Unknown",
        phone: c?.phone ?? null,
        property: c?.property_in_mind ?? c?.enquiry_prop_type ?? null,
        metadata: (event.metadata as Record<string, unknown>) ?? null,
        timestamp,
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

const router: IRouter = Router();

router.get("/dashboard/metrics", async (req, res) => {
  try {
    const since = typeof req.query.since === "string" ? req.query.since : null;

    const [allCustomers, allMetricEvents, conversations] = await Promise.all([
      fullScan(CUSTOMERS_TABLE),
      fullScan(METRICS_TABLE),
      fullScan(CONVERSATIONS_TABLE),
    ]);

    const customers = since
      ? allCustomers.filter((c) => typeof c.created_at === "string" && c.created_at >= since)
      : allCustomers;
    const metricEvents = since
      ? allMetricEvents.filter((e) => typeof e.timestamp === "string" && e.timestamp >= since)
      : allMetricEvents;

    // --- Customers ---
    const buyers = customers.filter((c) => c.customer_type === "buyer").length;
    const renters = customers.filter((c) => c.customer_type === "renter").length;
    const landlordsVendors = customers.filter((c) =>
      c.customer_type === "landlord" || c.customer_type === "vendor"
    ).length;
    const hotLeads = customers.filter((c) => Number(c.enquiry_max_price) > 0).length;
    const portalLeadsQualified = customers.filter(
      (c) => Number(c.enquiry_max_price) > 0 || Number(c.enquiry_bedrooms) > 0 || c.enquiry_postcode
    ).length;
    // --- Agent metrics ---
    const enquiryCustomers = new Set(
      metricEvents
        .filter((e) => e.event_type === "enquiry_received")
        .map((e) => e.customer_id)
    );
    const instantCustomers = new Set(
      metricEvents
        .filter((e) => e.event_type === "first_message_sent")
        .map((e) => e.customer_id)
    );
    const viewingEvents = metricEvents.filter((e) => e.event_type === "viewing_booked");
    const viewingCustomers = new Set(viewingEvents.map((e) => e.customer_id));
    const referralEvents = metricEvents.filter((e) => e.event_type === "referral");
    const referralCustomers = new Set(referralEvents.map((e) => e.customer_id));
    const reactivatedCustomers = new Set(
      metricEvents
        .filter((e) => e.event_type === "lead_reactivated")
        .map((e) => e.customer_id)
    );
    const reengagedCustomers = new Set(
      metricEvents
        .filter((e) => e.event_type === "reengagement_sent")
        .map((e) => e.customer_id)
    );

    const leadsEngaged = enquiryCustomers.size;
    const leadsEngagedInstantly = instantCustomers.size;
    const viewingsBooked = viewingCustomers.size;
    const referralLeads = referralCustomers.size;
    const reactivatedLeads = reactivatedCustomers.size;
    const reengagedLeads = reengagedCustomers.size;

    const customersById = new Map(allCustomers.map((c) => [c.customer_id as string, c as unknown as DynamoCustomer]));
    const customersByPhone = new Map(
      allCustomers
        .filter((c) => typeof c.phone === "string" && c.phone)
        .map((c) => [c.phone as string, c as unknown as DynamoCustomer])
    );
    const viewingsBookedList = detailListFromEvents(viewingEvents, customersById, customersByPhone);
    const referralLeadsList = detailListFromEvents(referralEvents, customersById, customersByPhone);

    // --- New enquiries last 7 days (from metrics) ---
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const enquiriesByDay: Record<string, number> = {};
    metricEvents
      .filter((e) => e.event_type === "enquiry_received")
      .forEach((e) => {
        const day = (e.timestamp as string).split("T")[0];
        if (day >= sevenDaysAgoStr) {
          enquiriesByDay[day] = (enquiriesByDay[day] ?? 0) + 1;
        }
      });

    const newConversationsLastWeek: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      newConversationsLastWeek.push({ date: dateStr, count: enquiriesByDay[dateStr] ?? 0 });
    }

    // --- Messages by channel (from conversations) ---
    const channelMap: Record<string, number> = {};
    conversations.forEach((c) => {
      const ch: string = (c.channel as string) || "whatsapp";
      channelMap[ch] = (channelMap[ch] ?? 0) + 1;
    });
    const messagesByChannel = Object.entries(channelMap).map(([channel, count]) => ({ channel, count }));
    if (messagesByChannel.length === 0) {
      messagesByChannel.push({ channel: "whatsapp", count: 0 });
    }

    // --- ROI ---
    const timeSavingsHours = (leadsEngagedInstantly * 15) / 60;
    const costSavingsGBP = timeSavingsHours * 25;

    // --- Funnel ---
    const funnel = {
      newLeads: customers.length,
      engaged: leadsEngaged,
      qualified: portalLeadsQualified,
      viewingsBooked,
      offers: Math.floor(viewingsBooked * 0.3),
    };

    res.json({
      leadsEngaged,
      leadsEngagedInstantly,
      viewingsBooked,
      reactivatedLeads,
      reengagedLeads,
      referralLeads,
      referralLeadsList,
      viewingsBookedList,
      portalLeadsQualified,
      hotLeads,
      buyers,
      renters,
      landlordsVendors,
      costSavingsGBP: Math.round(costSavingsGBP * 100) / 100,
      timeSavingsHours: Math.round(timeSavingsHours * 100) / 100,
      newConversationsLastWeek,
      messagesByChannel,
      funnel,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard metrics");
    res.status(500).json({ error: "Failed to get dashboard metrics" });
  }
});

export default router;
