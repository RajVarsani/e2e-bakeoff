import { internal } from "../ports";
const { api, crm } = internal;
for (const base of [api, crm]) {
  const r = await fetch(`${base}/test/reset`, { method: "POST" });
  console.log(base, r.status, await r.text());
  if (!r.ok) process.exitCode = 1;
}
