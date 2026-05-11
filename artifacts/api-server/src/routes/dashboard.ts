import { Router, type IRouter } from "express";
import { scanCustomers, scanAllConversationsByPhone } from "../lib/dynamodb";

const router: IRouter = Router();

router.get("/dashboard/metrics", async (req, res) => {
  try {
    const [customers, conversationsByPhone] = await Promise.all([
      scanCustomers(),
      scanAllConversationsByPhone(),
    ]);

    // ── Lead intent counts ──────────────────────────────────────────────────
    const buyers = customers.filter(
      (c) => c.lead_intent?.toLowerCase() === "buyer"
    ).length;

    const renters = customers.filter(
      (c) => c.lead_intent?.toLowerCase() === "renter"
    ).length;

    const landlordsVendors = customers.filter((c) =>
      ["landlord", "vendor"].includes(c.lead_intent?.toLowerCase() ?? "")
    ).length;

    // ── Hot leads: buyers with a budget set ─────────────────────────────────
    const hotLeads = customers.filter(
      (c) =>
        c.lead_intent?.toLowerCase() === "buyer" &&
        c.enquiry_max_price != null &&
        c.enquiry_max_price > 0
    ).length;

    // ── Tag-based metrics ───────────────────────────────────────────────────
    const hasTag = (tags: string[] | undefined, keyword: string) =>
      tags?.some((t) => t.toLowerCase().includes(keyword)) ?? false;

    const reactivatedLeads = customers.filter((c) =>
      hasTag(c.tags, "reactivat")
    ).length;

    const referralLeads = customers.filter((c) =>
      hasTag(c.tags, "referral")
    ).length;

    const viewingsBooked = customers.filter((c) =>
      hasTag(c.tags, "viewing")
    ).length;

    // ── Qualified: has at least one requirement field set ───────────────────
    const portalLeadsQualified = customers.filter(
      (c) =>
        (c.enquiry_max_price != null && c.enquiry_max_price > 0) ||
        (c.enquiry_bedrooms != null && c.enquiry_bedrooms > 0) ||
        (c.enquiry_postcode != null && c.enquiry_postcode.trim() !== "")
    ).length;

    // ── Engagement: customers that have at least one conversation ───────────
    const phonesWithConversations = new Set(Object.keys(conversationsByPhone));

    const engagedCustomers = customers.filter(
      (c) =>
        phonesWithConversations.has(c.phone ?? "") ||
        phonesWithConversations.has(c.customer_id)
    );
    const leadsEngaged = engagedCustomers.length;

    // ── Instant reply: conversations where bot sent at least one message ────
    //    (bot is role !== "user", meaning the assistant replied)
    const leadsEngagedInstantly = Object.values(conversationsByPhone).filter(
      (msgs) => msgs.some((m) => m.role !== "user")
    ).length;

    // ── Time / cost savings ─────────────────────────────────────────────────
    const timeSavingsHours = (viewingsBooked * 15) / 60;
    const costSavingsGBP = timeSavingsHours * 25;

    // ── New conversations last 7 days (by date of first message) ───────────
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyMap: Record<string, number> = {};
    for (const msgs of Object.values(conversationsByPhone)) {
      if (msgs.length === 0) continue;
      const earliest = msgs.reduce((min, m) =>
        m.timestamp < min.timestamp ? m : min
      );
      const d = new Date(earliest.timestamp);
      if (d >= sevenDaysAgo) {
        const dateStr = d.toISOString().split("T")[0];
        dailyMap[dateStr] = (dailyMap[dateStr] ?? 0) + 1;
      }
    }

    const newConversationsLastWeek: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      newConversationsLastWeek.push({
        date: dateStr,
        count: dailyMap[dateStr] ?? 0,
      });
    }

    // ── Messages by channel (all WhatsApp — phone-number based) ────────────
    const totalMessages = Object.values(conversationsByPhone).reduce(
      (sum, msgs) => sum + msgs.length,
      0
    );
    const messagesByChannel = [
      { channel: "whatsapp", count: totalMessages },
      { channel: "sms", count: 0 },
      { channel: "email", count: 0 },
    ];

    // ── Funnel ──────────────────────────────────────────────────────────────
    const funnel = {
      newLeads: customers.length,
      engaged: leadsEngaged,
      qualified: portalLeadsQualified,
      viewingsBooked,
      offers: 0,
    };

    res.json({
      leadsEngaged,
      leadsEngagedInstantly,
      viewingsBooked,
      reactivatedLeads,
      referralLeads,
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
