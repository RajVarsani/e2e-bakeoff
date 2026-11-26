import { useState, type FormEvent } from "react";
import { api, setToken, type User } from "./api";

export default function Login({ role, onLogin }: { role: User["role"]; onLogin: (u: User) => void }) {
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { email: f.get("email"), password: f.get("password") } });
      if (r.user.role !== role) { setError("This account cannot sign in here"); return; }
      setToken(r.token);
      onLogin(r.user);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={submit} aria-label="Sign in">
        <label>Email <input name="email" type="email" autoComplete="username" required /></label>
        <label>Password <input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
