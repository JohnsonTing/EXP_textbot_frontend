import type { Request } from "express";
import type { DynamoCustomer } from "./dynamodb";

// Admins see every customer; an agent sees only the leads they're responsible for.
export function filterCustomersByAgent<T extends Pick<DynamoCustomer, "responsible_agent_id" | "responsible_agent_email">>(
  customers: T[],
  req: Request
): T[] {
  if (req.user?.role === "admin") return customers;
  const agentId = req.user?.agent_id;
  const agentEmail = req.user?.email;
  return customers.filter((c) => {
    if (agentId && c.responsible_agent_id && String(c.responsible_agent_id) === String(agentId)) return true;
    if (c.responsible_agent_email === agentEmail) return true;
    return false;
  });
}
