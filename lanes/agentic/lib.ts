import { localBrowser, Stagehand } from "@browserbasehq/stagehand";
import type { z } from "zod/v4";
import { mkdirSync } from "node:fs";

const offset = Number(process.env.PORT_OFFSET ?? 0);
export const urls = {
  api: `http://127.0.0.1:${5100 + offset}`,
  admin: `http://admin.localhost:${5101 + offset}`,
  portal: `http://portal.localhost:${5102 + offset}`,
  crm: `http://crm.localhost:${5103 + offset}`,
};
export const MODEL = process.env.AGENT_MODEL ?? "claude-sonnet-5-5";
export const creds = {
  admin: { email: "admin@example.test", password: "admin-pass-1" },
  alice: { email: "alice@example.test", password: "alice-pass-1" },
  bob: { email: "bob@example.test", password: "bob-pass-1" },
  crm: { email: "crm.user@example.test", password: "crm-pass-1" },
};

export const usage = { in: 0, out: 0, calls: 0 };
const log = (m: string) => console.log(`    ${m}`);

export class Session {
  private constructor(private sh: Stagehand, private b: Awaited<ReturnType<typeof localBrowser.launch>>, public name: string) {}
  static async open(name: string) {
    const b = await localBrowser.launch({ headless: process.env.HEADED !== "1", executablePath: process.env.CHROME_PATH });
    const sh = await Stagehand.create({ browser: b, model: { modelName: `anthropic/${MODEL}`, apiKey: process.env.ANTHROPIC_API_KEY! } });
    return new Session(sh, b, name);
  }
  private async page() { return (await this.b.context.pages())[0]; }
  private track(u?: { inputTokens?: number; outputTokens?: number }) {
    usage.calls++; usage.in += u?.inputTokens ?? 0; usage.out += u?.outputTokens ?? 0;
  }
  async goto(url: string) { await (await this.page()).goto(url); }
  async url() { return (await this.page()).url(); }
  async act(instruction: string) {
    log(`[${this.name}] act: ${instruction}`);
    const r: any = await this.sh.act(instruction);
    this.track(r?.metadata?.usage);
    if (r?.data?.success === false) throw new Error(`act failed: ${instruction}: ${r.data.message ?? ""}`);
    return r;
  }
  async extract<S extends z.ZodType>(instruction: string, schema: S): Promise<z.output<S>> {
    const r: any = await this.sh.extract(instruction, schema);
    this.track(r?.metadata?.usage);
    return r.data;
  }
  /** Agentic wait: re-extract until predicate holds or timeout. No fixed sleeps beyond the poll interval. */
  async until<S extends z.ZodType>(label: string, instruction: string, schema: S, pred: (d: z.output<S>) => boolean, timeoutMs = 20000, intervalMs = 1500) {
    const t0 = Date.now(); const seen: string[] = [];
    for (;;) {
      const d = await this.extract(instruction, schema);
      seen.push(JSON.stringify(d));
      if (pred(d)) { log(`[${this.name}] ${label}: ok after ${Date.now() - t0}ms (${seen.length} polls)`); return { data: d, seen }; }
      if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${label}; last=${seen.at(-1)}`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  async close() { await this.sh.close().catch(() => {}); }
}

export function check(cond: unknown, msg: string): asserts cond { if (!cond) throw new Error(`assertion failed: ${msg}`); }

export async function api(path: string, init?: RequestInit) {
  const r = await fetch(urls.api + path, init);
  return r;
}
export async function reset() {
  for (const u of [urls.api, `http://127.0.0.1:${5103 + offset}`]) {
    const r = await fetch(`${u}/test/reset`, { method: "POST" }); check(r.ok, `reset ${u}`);
  }
}
export async function seed(letters: { title: string; body: string; recipientEmail: string; status: "draft" | "ready" }[]) {
  const r = await api("/test/seed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ letters }) });
  check(r.ok, `seed ${r.status}`);
}
export async function withSessions<T>(names: string[], fn: (s: Session[]) => Promise<T>) {
  const ss = await Promise.all(names.map((n) => Session.open(n)));
  try { return await fn(ss); } finally { await Promise.all(ss.map((s) => s.close())); }
}
export function artifactsDir() { mkdirSync("results", { recursive: true }); return "results"; }
