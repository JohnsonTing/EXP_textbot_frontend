import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  scanCustomers,
  getCustomer,
  putCustomer,
  updateCustomer,
  deleteCustomer,
  mapDynamoToContact,
  DynamoCustomer,
} from "../lib/dynamodb";

const router: IRouter = Router();

router.get("/contacts", async (req, res) => {
  try {
    const { search, tag, leadIntent } = req.query as Record<string, string>;
    let customers = await scanCustomers();

    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter(
        (c) =>
          (c.contact_name ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
      );
    }
    if (tag) {
      customers = customers.filter(
        (c) => Array.isArray(c.tags) && c.tags.includes(tag)
      );
    }
    if (leadIntent) {
      customers = customers.filter(
        (c) => c.lead_intent === leadIntent || c.customer_type === leadIntent
      );
    }

    res.json(customers.map(mapDynamoToContact));
  } catch (err) {
    req.log.error({ err }, "Failed to list contacts from DynamoDB");
    res.status(500).json({ error: "Failed to list contacts" });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const body = req.body;
    const now = new Date().toISOString();
    const item: DynamoCustomer = {
      customer_id: uuidv4(),
      contact_name: body.name,
      email: body.email ?? undefined,
      phone: body.phone,
      tags: body.tags ?? [],
      lead_intent: body.leadIntent ?? undefined,
      summary: body.summary ?? undefined,
      property_in_mind: body.propertyInMind ?? undefined,
      enquiry_bedrooms: body.bedrooms ?? undefined,
      enquiry_max_price: body.budget ? parseInt(body.budget.replace(/[^0-9]/g, "")) || undefined : undefined,
      status: "active",
      created_at: now,
      updated_at: now,
    };
    await putCustomer(item);
    res.status(201).json(mapDynamoToContact(item));
  } catch (err) {
    req.log.error({ err }, "Failed to create contact in DynamoDB");
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.get("/contacts/:id", async (req, res) => {
  try {
    const customer = await getCustomer(req.params.id);
    if (!customer) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json(mapDynamoToContact(customer));
  } catch (err) {
    req.log.error({ err }, "Failed to get contact from DynamoDB");
    res.status(500).json({ error: "Failed to get contact" });
  }
});

router.put("/contacts/:id", async (req, res) => {
  try {
    const body = req.body;
    const updated = await updateCustomer(req.params.id, {
      contact_name: body.name,
      email: body.email,
      phone: body.phone,
      tags: body.tags,
      lead_intent: body.leadIntent,
      summary: body.summary,
      property_in_mind: body.propertyInMind,
      enquiry_bedrooms: body.bedrooms,
      enquiry_max_price: body.budget ? parseInt(body.budget.replace(/[^0-9]/g, "")) || undefined : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json(mapDynamoToContact(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update contact in DynamoDB");
    res.status(500).json({ error: "Failed to update contact" });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    await deleteCustomer(req.params.id);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete contact from DynamoDB");
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

export default router;
