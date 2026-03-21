import { Router, type IRouter } from "express";
import { db, contactsTable, conversationsTable, messagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/conversations", async (req, res) => {
  try {
    const { search, channel } = req.query as Record<string, string>;

    const rows = await db
      .select({
        id: conversationsTable.id,
        contactId: conversationsTable.contactId,
        contactName: contactsTable.name,
        contactPhone: contactsTable.phone,
        channel: conversationsTable.channel,
        status: conversationsTable.status,
        lastMessage: conversationsTable.lastMessage,
        lastMessageAt: conversationsTable.lastMessageAt,
        unreadCount: conversationsTable.unreadCount,
        createdAt: conversationsTable.createdAt,
      })
      .from(conversationsTable)
      .innerJoin(contactsTable, eq(conversationsTable.contactId, contactsTable.id))
      .orderBy(desc(conversationsTable.lastMessageAt));

    let result = rows;
    if (search) {
      result = result.filter(
        (r) =>
          r.contactName.toLowerCase().includes(search.toLowerCase()) ||
          r.contactPhone.includes(search)
      );
    }
    if (channel) {
      result = result.filter((r) => r.channel === channel);
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const { contactId, channel } = req.body;
    if (!contactId || !channel) {
      res.status(400).json({ error: "contactId and channel are required" });
      return;
    }
    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId));
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    const [conv] = await db.insert(conversationsTable).values({ contactId, channel }).returning();
    res.status(201).json({
      ...conv,
      contactName: contact.name,
      contactPhone: contact.phone,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [row] = await db
      .select({
        id: conversationsTable.id,
        contactId: conversationsTable.contactId,
        contactName: contactsTable.name,
        contactPhone: contactsTable.phone,
        channel: conversationsTable.channel,
        status: conversationsTable.status,
        lastMessage: conversationsTable.lastMessage,
        lastMessageAt: conversationsTable.lastMessageAt,
        unreadCount: conversationsTable.unreadCount,
        createdAt: conversationsTable.createdAt,
      })
      .from(conversationsTable)
      .innerJoin(contactsTable, eq(conversationsTable.contactId, contactsTable.id))
      .where(eq(conversationsTable.id, id));

    if (!row) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.sentAt);

    await db
      .update(conversationsTable)
      .set({ unreadCount: 0 })
      .where(eq(conversationsTable.id, id));

    res.json({ ...row, messages });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.sentAt);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const [message] = await db
      .insert(messagesTable)
      .values({
        conversationId: id,
        direction: "outbound",
        content,
        senderName: "Agent",
      })
      .returning();

    await db
      .update(conversationsTable)
      .set({ lastMessage: content, lastMessageAt: new Date() })
      .where(eq(conversationsTable.id, id));

    res.status(201).json(message);
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
