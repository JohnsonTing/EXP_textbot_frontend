import { Router, type IRouter } from "express";
import {
  scanAllConversationsByPhone,
  getMessagesByPhone,
  scanCustomers,
  updateCustomer,
  putCustomer,
  buildCustomerName,
  type DynamoMessage,
} from "../lib/dynamodb";

const router: IRouter = Router();

function buildConversationList(
  grouped: Record<string, DynamoMessage[]>,
  customers: Record<
    string,
    { name: string; phone: string; customerId: string; botPaused: boolean }
  >,
) {
  return Object.entries(grouped)
    .map(([phone, messages]) => {
      const sorted = [...messages].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const last = sorted[sorted.length - 1];
      const customer = customers[phone];
      return {
        id: phone,
        contactId: customer?.customerId ?? phone,
        contactName: customer?.name ?? phone,
        contactPhone: phone,
        channel: "whatsapp",
        status: "active",
        botPaused: customer?.botPaused ?? false,
        lastMessage: last?.message ?? null,
        lastMessageAt: last?.timestamp ?? null,
        unreadCount: 0,
        createdAt: sorted[0]?.timestamp ?? new Date().toISOString(),
        messageCount: messages.length,
      };
    })
    .sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
}

router.get("/conversations", async (req, res) => {
  try {
    const { search } = req.query as Record<string, string>;

    const [grouped, allCustomers] = await Promise.all([
      scanAllConversationsByPhone(),
      scanCustomers(),
    ]);

    const customersByPhone: Record<
      string,
      { name: string; phone: string; customerId: string; botPaused: boolean }
    > = {};
    for (const c of allCustomers) {
      const ph = c.phone || c.customer_id;
      if (ph) {
        const name = buildCustomerName(c) !== "Unknown" ? buildCustomerName(c) : ph;
        customersByPhone[ph] = { name, phone: ph, customerId: c.customer_id, botPaused: c.bot_paused ?? false };
      }
    }

    let result = buildConversationList(grouped, customersByPhone);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.contactName.toLowerCase().includes(q) ||
          r.contactPhone.includes(q) ||
          (r.lastMessage ?? "").toLowerCase().includes(q),
      );
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations from DynamoDB");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.get("/conversations/:phone", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);

    const [messages, allCustomers] = await Promise.all([
      getMessagesByPhone(phone),
      scanCustomers(),
    ]);

    const customer = allCustomers.find((c) => c.phone === phone);

    const sorted = [...messages].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const mappedMessages = sorted.map((m) => ({
      id: m.message_id,
      conversationId: phone,
      direction: m.role === "user" ? "inbound" : "outbound",
      content: m.message,
      role: m.role,
      senderName:
        m.role === "user" ? (customer ? buildCustomerName(customer) : phone) : "Assistant",
      sentAt: m.timestamp,
    }));

    const last = sorted[sorted.length - 1];

    res.json({
      id: phone,
      contactId: customer?.customer_id ?? phone,
      contactName: customer ? buildCustomerName(customer) : phone,
      contactPhone: phone,
      channel: "whatsapp",
      status: "active",
      botPaused: customer?.bot_paused ?? false,
      lastMessage: last?.message ?? null,
      lastMessageAt: last?.timestamp ?? null,
      unreadCount: 0,
      createdAt: sorted[0]?.timestamp ?? new Date().toISOString(),
      messages: mappedMessages,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation from DynamoDB");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

const findCustomerByPhone = (customers: Awaited<ReturnType<typeof scanCustomers>>, phone: string) =>
  customers.find((c) => c.phone === phone || c.customer_id === phone);

router.get("/conversations/:phone/bot-status", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const customer = findCustomerByPhone(await scanCustomers(), phone);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.json({ phone, botPaused: customer.bot_paused ?? false });
  } catch (err) {
    req.log.error({ err }, "Failed to get bot status");
    res.status(500).json({ error: "Failed to get bot status" });
  }
});

router.patch("/conversations/:phone/bot-mode", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const { paused } = req.body as { paused: boolean };

    let customer = findCustomerByPhone(await scanCustomers(), phone);
    if (!customer) {
      const now = new Date().toISOString();
      await putCustomer({ customer_id: phone, phone, created_at: now, updated_at: now, bot_paused: paused });
    } else {
      await updateCustomer(customer.customer_id, { bot_paused: paused });
    }
    res.json({ botPaused: paused });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle bot mode");
    res.status(500).json({ error: "Failed to toggle bot mode" });
  }
});

const LAMBDA_SEND_URL =
  "https://jpdrrnrnot2pslmpq4vcxatsey0ofvud.lambda-url.us-east-1.on.aws/send";

router.post("/conversations/:phone/messages", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const { content } = req.body as { content?: string };

    if (!content || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const lambdaPayload = JSON.stringify({
      phone: `${phone}`,
      message: content.trim(),
    });
    req.log.info(
      { url: LAMBDA_SEND_URL, payload: lambdaPayload },
      "Sending to Lambda",
    );

    const lambdaRes = await fetch(LAMBDA_SEND_URL, {
      method: "POST",
      //headers: { "Content-Type": "application/json" },
      body: lambdaPayload,
    });

    const responseText = await lambdaRes.text();
    req.log.info(
      { status: lambdaRes.status, body: responseText },
      "Lambda send response",
    );

    if (!lambdaRes.ok) {
      req.log.error(
        { status: lambdaRes.status, body: responseText },
        "Lambda returned error",
      );
      // 403 from the Lambda means the number isn't registered in the WhatsApp system
      const userMessage =
        lambdaRes.status === 403
          ? "This number is not registered as a WhatsApp contact"
          : "Failed to send message";
      res
        .status(lambdaRes.status === 403 ? 403 : 502)
        .json({ error: userMessage, detail: responseText });
      return;
    }

    const now = new Date().toISOString();
    res.status(201).json({
      id: `local-${Date.now()}`,
      conversationId: phone,
      direction: "outbound",
      role: "user",
      content: content.trim(),
      senderName: "Agent",
      sentAt: now,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
