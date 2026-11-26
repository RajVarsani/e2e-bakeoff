import { useEffect, useState } from "react";
import { api, getToken, setToken, type User } from "./api";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!getToken());
  useEffect(() => {
    if (!getToken()) return;
    api<{ user: User }>("/auth/me").then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);
  const logout = async () => { await api("/auth/logout", { method: "POST" }).catch(() => {}); setToken(null); setUser(null); };
  return { user, setUser, loading, logout };
}
