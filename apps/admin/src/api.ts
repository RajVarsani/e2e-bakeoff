const API = import.meta.env.VITE_API_URL as string;
const KEY = "token";

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as { error?: string }).error ?? res.statusText), { status: res.status });
  return data as T;
}

export type User = { id: number; email: string; name: string; role: "admin" | "portal" };
