import { Database } from "bun:sqlite";

export const db = new Database(process.env.DB_PATH ?? "data.db", { create: true });
db.exec("PRAGMA journal_mode = WAL");

export const hash = (pw: string) => new Bun.CryptoHasher("sha256").update(pw).digest("hex");

db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, name TEXT, password TEXT, role TEXT);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER);
CREATE TABLE IF NOT EXISTS letters (
  id INTEGER PRIMARY KEY, title TEXT, body TEXT, recipient_id INTEGER,
  published INTEGER DEFAULT 0, status TEXT DEFAULT 'draft', version INTEGER DEFAULT 1,
  rendered_body TEXT, rendered_version INTEGER, render_at INTEGER, force_fail INTEGER DEFAULT 0,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS crm_connections (user_id INTEGER PRIMARY KEY, access_token TEXT, connected_at INTEGER);
CREATE TABLE IF NOT EXISTS crm_clients (id INTEGER PRIMARY KEY, user_id INTEGER, external_id TEXT, name TEXT, email TEXT);
`);

export function wipeAndSeed() {
  db.exec("DELETE FROM users; DELETE FROM sessions; DELETE FROM letters; DELETE FROM crm_connections; DELETE FROM crm_clients;");
  const ins = db.prepare("INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)");
  ins.run("admin@example.test", "Admin User", hash("admin-pass-1"), "admin");
  ins.run("alice@example.test", "Alice Portal", hash("alice-pass-1"), "portal");
  ins.run("bob@example.test", "Bob Portal", hash("bob-pass-1"), "portal");
}

if ((db.query("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n === 0) wipeAndSeed();
