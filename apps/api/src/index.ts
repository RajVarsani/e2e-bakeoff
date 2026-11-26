import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { db, hash, wipeAndSeed } from "./db";
import "./worker";

const PORT = Number(process.env.API_PORT ?? 5100);
const TEST_MODE = process.env.TEST_MODE === "1";
const CRM_INTERNAL = process.env.CRM_INTERNAL_URL ?? "http://127.0.0.1:5103";
const CLIENT_ID = process.env.CRM_CLIENT_ID ?? "portal-app";
const CLIENT_SECRET = process.env.CRM_CLIENT_SECRET ?? "portal-secret";

type User = { id: number; email: string; name: string; role: "admin" | "portal" };
type Letter = {
  id: number; title: string; body: string; recipient_id: number | null; published: number;
  status: string; version: number; rendered_body: string | null; rendered_version: number | null;
  force_fail: number; updated_at: number;
};

const app = new Hono<{ Variables: { user: User } }>();
app.use("*", cors({
  origin: (o) => (/^http:\/\/[a-z0-9-]+\.localhost:\d+$/.test(o) || /^http:\/\/127\.0\.0\.1:\d+$/.test(o) ? o : null),
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

const fresh = (id: number) => db.query("SELECT * FROM letters WHERE id = ?").get(id) as Letter | null;
const adminView = (l: Letter) => ({
  id: l.id, title: l.title, body: l.body, recipientId: l.recipient_id, published: !!l.published,
  status: l.status, version: l.version, updatedAt: l.updated_at,
});

async function auth(c: Context, next: () => Promise<void>) {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
  const user = token
    ? (db.query("SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?").get(token) as User | null)
    : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);
  c.set("user", user);
  await next();
}
async function adminOnly(c: Context, next: () => Promise<void>) {
  if ((c.get("user") as User).role !== "admin") return c.json({ error: "forbidden" }, 403);
  await next();
}

app.get("/health", (c) => c.json({ ok: true }));

// auth
app.post("/auth/login", async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  const row = db.query("SELECT id, email, name, role, password FROM users WHERE email = ?").get(String(email ?? "")) as (User & { password: string }) | null;
  if (!row || row.password !== hash(String(password ?? ""))) return c.json({ error: "Invalid email or password" }, 401);
  const token = crypto.randomUUID();
  db.query("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, row.id);
  return c.json({ token, user: { id: row.id, email: row.email, name: row.name, role: row.role } });
});
app.get("/auth/me", auth, (c) => c.json({ user: c.get("user") }));
app.post("/auth/logout", auth, (c) => {
  db.query("DELETE FROM sessions WHERE token = ?").run(c.req.header("Authorization")!.replace(/^Bearer /, ""));
  return c.json({ ok: true });
});

// admin: users + letters
app.get("/users", auth, adminOnly, (c) =>
  c.json(db.query("SELECT id, email, name FROM users WHERE role = 'portal' ORDER BY id").all()));

app.get("/letters", auth, adminOnly, (c) =>
  c.json((db.query("SELECT * FROM letters ORDER BY id DESC").all() as Letter[]).map(adminView)));
app.get("/letters/:id", auth, adminOnly, (c) => {
  const l = fresh(Number(c.req.param("id")));
  return l ? c.json(adminView(l)) : c.json({ error: "not found" }, 404);
});
app.post("/letters", auth, adminOnly, async (c) => {
  const { title, body, recipientId } = await c.req.json();
  if (!title || !body || !recipientId) return c.json({ error: "title, body and recipientId are required" }, 400);
  const r = db.query("INSERT INTO letters (title, body, recipient_id, updated_at) VALUES (?, ?, ?, ?)").run(title, body, recipientId, Date.now());
  return c.json(adminView(fresh(Number(r.lastInsertRowid))!), 201);
});

function startRender(id: number, forceFail: boolean) {
  const delay = 2000 + Math.random() * 4000;
  db.query("UPDATE letters SET status = 'rendering', render_at = ?, force_fail = ?, updated_at = ? WHERE id = ?")
    .run(Date.now() + delay, forceFail ? 1 : 0, Date.now(), id);
}
// forceFail=1 query hook only works when TEST_MODE=1
const wantsFail = (c: Context) => TEST_MODE && c.req.query("forceFail") === "1";

app.put("/letters/:id", auth, adminOnly, async (c) => {
  const id = Number(c.req.param("id"));
  const l = fresh(id);
  if (!l) return c.json({ error: "not found" }, 404);
  const b = await c.req.json();
  db.query("UPDATE letters SET title = ?, body = ?, recipient_id = ?, version = version + 1, updated_at = ? WHERE id = ?")
    .run(b.title ?? l.title, b.body ?? l.body, b.recipientId ?? l.recipient_id, Date.now(), id);
  if (l.published) startRender(id, wantsFail(c));
  return c.json(adminView(fresh(id)!));
});
app.post("/letters/:id/publish", auth, adminOnly, (c) => {
  const id = Number(c.req.param("id"));
  const l = fresh(id);
  if (!l) return c.json({ error: "not found" }, 404);
  if (l.status === "rendering") return c.json({ error: "already rendering" }, 409);
  db.query("UPDATE letters SET published = 1 WHERE id = ?").run(id);
  startRender(id, wantsFail(c));
  return c.json(adminView(fresh(id)!));
});
app.delete("/letters/:id", auth, adminOnly, (c) => {
  db.query("DELETE FROM letters WHERE id = ?").run(Number(c.req.param("id")));
  return c.json({ ok: true });
});

// portal inbox: only the caller's own published letters
const inboxItem = (l: Letter) => ({
  id: l.id, title: l.title, status: l.status, updatedAt: l.updated_at,
  content: l.status === "ready" ? l.rendered_body : null,
});
app.get("/inbox", auth, (c) => {
  const u = c.get("user");
  return c.json((db.query("SELECT * FROM letters WHERE published = 1 AND recipient_id = ? ORDER BY id DESC").all(u.id) as Letter[]).map(inboxItem));
});
app.get("/inbox/:id", auth, (c) => {
  const u = c.get("user");
  const l = db.query("SELECT * FROM letters WHERE id = ? AND published = 1 AND recipient_id = ?").get(Number(c.req.param("id")), u.id) as Letter | null;
  return l ? c.json(inboxItem(l)) : c.json({ error: "not found" }, 404);
});

// CRM connection
app.get("/crm/connection", auth, (c) => {
  const u = c.get("user");
  const conn = db.query("SELECT connected_at FROM crm_connections WHERE user_id = ?").get(u.id) as { connected_at: number } | null;
  const clients = db.query("SELECT external_id AS id, name, email FROM crm_clients WHERE user_id = ? ORDER BY id").all(u.id);
  return c.json({ connected: !!conn, connectedAt: conn?.connected_at ?? null, clients });
});
app.post("/crm/connect", auth, async (c) => {
  const u = c.get("user");
  const { code, redirectUri } = await c.req.json();
  const tok = await fetch(`${CRM_INTERNAL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!tok.ok) return c.json({ error: "token exchange failed" }, 400);
  const { access_token } = (await tok.json()) as { access_token: string };
  const res = await fetch(`${CRM_INTERNAL}/api/clients`, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) return c.json({ error: "client import failed" }, 502);
  const clients = (await res.json()) as { id: string; name: string; email: string }[];
  db.query("INSERT OR REPLACE INTO crm_connections (user_id, access_token, connected_at) VALUES (?, ?, ?)").run(u.id, access_token, Date.now());
  db.query("DELETE FROM crm_clients WHERE user_id = ?").run(u.id);
  const ins = db.prepare("INSERT INTO crm_clients (user_id, external_id, name, email) VALUES (?, ?, ?, ?)");
  for (const cl of clients) ins.run(u.id, cl.id, cl.name, cl.email);
  return c.json({ connected: true, imported: clients.length });
});
app.delete("/crm/connection", auth, (c) => {
  const u = c.get("user");
  db.query("DELETE FROM crm_connections WHERE user_id = ?").run(u.id);
  db.query("DELETE FROM crm_clients WHERE user_id = ?").run(u.id);
  return c.json({ ok: true });
});

// test support
if (TEST_MODE) {
  app.post("/test/reset", (c) => { wipeAndSeed(); return c.json({ ok: true }); });
  app.post("/test/seed", async (c) => {
    const { letters = [] } = await c.req.json().catch(() => ({}));
    const out: unknown[] = [];
    for (const l of letters as { title: string; body: string; recipientEmail: string; status?: "draft" | "ready" }[]) {
      const u = db.query("SELECT id FROM users WHERE email = ?").get(l.recipientEmail) as { id: number } | null;
      if (!u) return c.json({ error: `unknown recipient ${l.recipientEmail}` }, 400);
      const ready = l.status === "ready";
      const r = db.query(
        "INSERT INTO letters (title, body, recipient_id, published, status, rendered_body, rendered_version, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
      ).run(l.title, l.body, u.id, ready ? 1 : 0, ready ? "ready" : "draft", ready ? l.body : null, Date.now());
      out.push(adminView(fresh(Number(r.lastInsertRowid))!));
    }
    return c.json({ letters: out }, 201);
  });
}

export default { port: PORT, hostname: "127.0.0.1", fetch: app.fetch };
console.log(`api listening on :${PORT} (TEST_MODE=${TEST_MODE ? 1 : 0}, FLAKY=${process.env.FLAKY ?? 0})`);
