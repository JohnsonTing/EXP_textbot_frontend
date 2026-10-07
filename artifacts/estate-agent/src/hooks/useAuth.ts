import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Agent {
  email: string;
  name: string;
  role: string;
  phone?: string;
}

async function fetchMe(): Promise<Agent | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Auth check failed");
  return res.json();
}

async function postLogin(email: string, password: string): Promise<Agent> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Login failed");
  }
  return res.json();
}

async function postLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export function useAuth() {
  const { data, isPending } = useQuery<Agent | null>({
    queryKey: ["auth-me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: data ?? null,
    isLoading: isPending,
    isAuthenticated: !!data,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      postLogin(email, password),
    onSuccess: (agent) => {
      queryClient.setQueryData(["auth-me"], agent);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postLogout,
    onSuccess: () => {
      queryClient.setQueryData(["auth-me"], null);
      queryClient.clear();
    },
  });
}
