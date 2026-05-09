import { useState, useEffect } from "react";

export interface AuthUser {
  name: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data ?? null))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }

  return { user, loading: user === undefined, logout };
}
