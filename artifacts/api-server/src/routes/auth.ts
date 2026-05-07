import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getAgent, putAgent, listAgents } from "../lib/dynamodb";
import { signToken } from "../lib/auth";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const agent = await getAgent(email.toLowerCase());
    if (!agent) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ email: agent.email, name: agent.name, role: agent.role });
    res.cookie("auth_token", token, COOKIE_OPTS);
    res.json({ email: agent.email, name: agent.name, role: agent.role, phone: agent.phone });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("auth_token");
  res.json({ ok: true });
});

router.get("/auth/me", authMiddleware, (req, res) => {
  res.json(req.user);
});

// Admin-only: register a new agent
router.post("/auth/register", authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    const { email, password, name, phone, role = "agent" } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "email, password, name required" });
      return;
    }
    const existing = await getAgent(email.toLowerCase());
    if (existing) {
      res.status(409).json({ error: "Agent already exists" });
      return;
    }
    const password_hash = await bcrypt.hash(password, 12);
    await putAgent({
      email: email.toLowerCase(),
      agent_id: uuidv4(),
      password_hash,
      name,
      phone: phone ?? undefined,
      role,
      created_at: new Date().toISOString(),
    });
    res.status(201).json({ email, name, role });
  } catch (err) {
    req.log.error({ err }, "Register failed");
    res.status(500).json({ error: "Register failed" });
  }
});

// Admin-only: list all agents
router.get("/auth/agents", authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    const agents = await listAgents();
    res.json(agents.map(a => ({ email: a.email, name: a.name, role: a.role, phone: a.phone, created_at: a.created_at })));
  } catch (err) {
    req.log.error({ err }, "List agents failed");
    res.status(500).json({ error: "Failed to list agents" });
  }
});

export default router;
