import { Router, type IRouter } from "express";
import { db, contactsTable, insertContactSchema, updateContactSchema } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/contacts", async (req, res) => {
  try {
    const { search, tag, leadIntent } = req.query as Record<string, string>;
    let query = db.select().from(contactsTable);

    const conditions: ReturnType<typeof ilike>[] = [];

    if (search) {
      conditions.push(ilike(contactsTable.name, `%${search}%`));
    }
    if (leadIntent) {
      conditions.push(eq(contactsTable.leadIntent, leadIntent) as any);
    }

    let contacts = await query;

    if (tag) {
      contacts = contacts.filter((c) =>
        Array.isArray(c.tags) && (c.tags as string[]).includes(tag)
      );
    }

    if (search) {
      contacts = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search) ||
          (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
      );
    }

    if (leadIntent) {
      contacts = contacts.filter((c) => c.leadIntent === leadIntent);
    }

    res.json(contacts);
  } catch (err) {
    req.log.error({ err }, "Failed to list contacts");
    res.status(500).json({ error: "Failed to list contacts" });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const parsed = insertContactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      return;
    }
    const [contact] = await db.insert(contactsTable).values(parsed.data).returning();
    res.status(201).json(contact);
  } catch (err) {
    req.log.error({ err }, "Failed to create contact");
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.get("/contacts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json(contact);
  } catch (err) {
    req.log.error({ err }, "Failed to get contact");
    res.status(500).json({ error: "Failed to get contact" });
  }
});

router.put("/contacts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = updateContactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      return;
    }
    const [contact] = await db
      .update(contactsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(contactsTable.id, id))
      .returning();
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json(contact);
  } catch (err) {
    req.log.error({ err }, "Failed to update contact");
    res.status(500).json({ error: "Failed to update contact" });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(contactsTable).where(eq(contactsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete contact");
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

export default router;
