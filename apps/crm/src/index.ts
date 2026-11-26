import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { Database } from "bun:sqlite";

const PORT = Number(process.env.CRM_PORT ?? 5103);
const TEST_MODE = process.env.TEST_MODE === "1";
const PORTAL_URL = process.env.PORTAL_URL ?? "http://portal.localhost:5102";
const CLIENT_ID = process.env.CRM_CLIENT_ID ?? "portal-app";
const CLIENT_SECRET = process.env.CRM_CLIENT_SECRET ?? "portal-secret";
const ALLOWED_REDIRECTS = [`${PORTAL_URL}/crm/callback`];

const db = new Database(process.env.CRM_DB_PATH ?? "crm.db", { create: true });
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, name TEXT, password TEXT);
CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, email TEXT);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER);
CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY, user_id INTEGER, redirect_uri TEXT, used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, user_id INTEGER);
`);

function reseed() {
  db.exec("DELETE FROM users; DELETE FROM clients; DELETE FROM sessions; DELETE FROM codes; DELETE FROM tokens");
  db.query("INSERT INTO users (email, name, password) VALUES (?, ?, ?)").run("crm.user@example.test", "CRM User", "crm-pass-1");
  const ins = db.prepare("INSERT INTO clients (user_id, name, email) VALUES (1, ?, ?)");
  ins.run("Jordan Lee", "jordan.lee@clients.example.test");
  ins.run("Sam Patel", "sam.patel@clients.example.test");
  ins.run("Riley Chen", "riley.chen@clients.example.test");
}
if ((db.query("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n === 0) reseed();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#eef2f7;margin:0}main{max-width:380px;margin:60px auto;background:#fff;padding:24px;border:1px solid #ccd;border-radius:6px}
form{display:grid;gap:12px}label{display:grid;gap:4px;font-size:14px}input{font:inherit;padding:6px 8px}button{font:inherit;padding:6px 12px;cursor:pointer}.error{color:#b00020}</style></head>
<body><main>${body}</main></body></html>`;

const sessionUser = (c: Parameters<typeof getCookie>[0]) => {
  const t = getCookie(c, "crm_session");
  return t ? (db.query("SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?").get(t) as { id: number; name: string; email: string } | null) : null;
};

const app = new Hono();
app.get("/", (c) => c.html(page("CRM", `<h1>CRM</h1><p>A standalone client management service.</p><p><a href="/login">Sign in</a></p>`)));
app.get("/health", (c) => c.json({ ok: true }));

const loginForm = (next: string, error = "") => page("CRM sign in", `
<h1>CRM sign in</h1>${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}
<form method="post" action="/login">
  <input type="hidden" name="next" value="${esc(next)}">
  <label>Email <input name="email" type="email" autocomplete="username" required></label>
  <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
  <button type="submit">Sign in</button>
</form>`);

app.get("/login", (c) => c.html(loginForm(c.req.query("next") ?? "/")));
app.post("/login", async (c) => {
  const f = await c.req.parseBody();
  const u = db.query("SELECT id FROM users WHERE email = ? AND password = ?").get(String(f.email), String(f.password)) as { id: number } | null;
  const next = String(f.next || "/");
  if (!u) return c.html(loginForm(next, "Invalid email or password"), 401);
  const token = crypto.randomUUID();
  db.query("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, u.id);
  setCookie(c, "crm_session", token, { httpOnly: true, path: "/", sameSite: "Lax" });
  return c.redirect(next.startsWith("/") ? next : "/");
});
app.post("/logout", (c) => { deleteCookie(c, "crm_session", { path: "/" }); return c.redirect("/login"); });

// OAuth authorization endpoint
app.get("/authorize", (c) => {
  const q = c.req.query();
  if (q.client_id !== CLIENT_ID || q.response_type !== "code" || !ALLOWED_REDIRECTS.includes(q.redirect_uri ?? ""))
    return c.html(page("Invalid request", `<h1>Invalid authorization request</h1>`), 400);
  const user = sessionUser(c);
  if (!user) return c.redirect(`/login?next=${encodeURIComponent(c.req.url.replace(new URL(c.req.url).origin, ""))}`);
  return c.html(page("Authorize access", `
<h1>Authorize access</h1>
<p>Portal app wants to read your clients as <strong>${esc(user.name)}</strong> (${esc(user.email)}).</p>
<form method="post" action="/authorize">
  <input type="hidden" name="redirect_uri" value="${esc(q.redirect_uri)}">
  <input type="hidden" name="state" value="${esc(q.state ?? "")}">
  <button type="submit" name="decision" value="allow">Allow</button>
  <button type="submit" name="decision" value="deny">Deny</button>
</form>`));
});
app.post("/authorize", async (c) => {
  const user = sessionUser(c);
  if (!user) return c.redirect("/login");
  const f = await c.req.parseBody();
  const redirect = String(f.redirect_uri);
  if (!ALLOWED_REDIRECTS.includes(redirect)) return c.text("bad redirect_uri", 400);
  const url = new URL(redirect);
  if (f.state) url.searchParams.set("state", String(f.state));
  if (f.decision !== "allow") {
    url.searchParams.set("error", "access_denied");
    return c.redirect(url.toString());
  }
  const code = crypto.randomUUID();
  db.query("INSERT INTO codes (code, user_id, redirect_uri) VALUES (?, ?, ?)").run(code, user.id, redirect);
  url.searchParams.set("code", code);
  return c.redirect(url.toString());
});

// token exchange (JSON or form body)
app.post("/oauth/token", async (c) => {
  const b = c.req.header("content-type")?.includes("json") ? await c.req.json() : await c.req.parseBody();
  if (b.grant_type !== "authorization_code" || b.client_id !== CLIENT_ID || b.client_secret !== CLIENT_SECRET)
    return c.json({ error: "invalid_client" }, 401);
  const row = db.query("SELECT user_id, redirect_uri, used FROM codes WHERE code = ?").get(String(b.code)) as { user_id: number; redirect_uri: string; used: number } | null;
  if (!row || row.used || row.redirect_uri !== b.redirect_uri) return c.json({ error: "invalid_grant" }, 400);
  db.query("UPDATE codes SET used = 1 WHERE code = ?").run(String(b.code));
  const token = crypto.randomUUID();
  db.query("INSERT INTO tokens (token, user_id) VALUES (?, ?)").run(token, row.user_id);
  return c.json({ access_token: token, token_type: "Bearer" });
});

app.get("/api/clients", (c) => {
  const t = c.req.header("Authorization")?.replace(/^Bearer /, "");
  const tok = t ? (db.query("SELECT user_id FROM tokens WHERE token = ?").get(t) as { user_id: number } | null) : null;
  if (!tok) return c.json({ error: "unauthorized" }, 401);
  return c.json(db.query("SELECT CAST(id AS TEXT) AS id, name, email FROM clients WHERE user_id = ? ORDER BY id").all(tok.user_id));
});

if (TEST_MODE) app.post("/test/reset", (c) => { reseed(); return c.json({ ok: true }); });

export default { port: PORT, hostname: "127.0.0.1", fetch: app.fetch };
console.log(`crm listening on :${PORT}`);
