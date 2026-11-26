import { writeFileSync } from "node:fs";
import { artifactsDir, MODEL, usage } from "./lib.ts";
import { scenarios } from "./scenarios.ts";

const only = (process.env.ONLY ?? "").split(",").filter(Boolean);
const names = Object.keys(scenarios).filter((n) => !only.length || only.includes(n));
const res: Record<string, { pass: boolean; ms: number; err?: string; in: number; out: number }> = {};
const t0 = Date.now();
for (const n of names) {
  console.log(`== ${n}`);
  const s = Date.now(), u0 = { ...usage };
  try { await scenarios[n](); res[n] = { pass: true, ms: Date.now() - s, in: usage.in - u0.in, out: usage.out - u0.out }; console.log(`   PASS ${n} ${Date.now() - s}ms`); }
  catch (e: any) { res[n] = { pass: false, ms: Date.now() - s, err: String(e?.message ?? e).slice(0, 400), in: usage.in - u0.in, out: usage.out - u0.out }; console.log(`   FAIL ${n}: ${res[n].err}`); }
}
const total = { model: MODEL, ms: Date.now() - t0, ...usage, pass: names.filter((n) => res[n].pass).length, of: names.length, res };
artifactsDir();
writeFileSync(process.env.OUT ?? "results/run.json", JSON.stringify(total, null, 1));
console.log(`SUMMARY ${total.pass}/${total.of} in ${total.ms}ms tokens in=${usage.in} out=${usage.out} calls=${usage.calls}`);
process.exit(total.pass === total.of ? 0 : 1);
