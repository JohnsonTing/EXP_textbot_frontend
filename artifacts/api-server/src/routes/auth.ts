import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { getAgentByEmail } from "../lib/dynamodb";
import { signToken } from "../lib/auth";

const router: IRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const agent = await getAgentByEmail(email.toLowerCase());
  if (!agent || !agent.password_hash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, agent.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ email: agent.email, name: agent.name, role: agent.role, agent_id: agent.agent_id });
  res.cookie("token", token, COOKIE_OPTS);
  res.json({ email: agent.email, name: agent.name, role: agent.role });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
});

export default router;
