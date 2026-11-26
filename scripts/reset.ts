const api = process.env.API_URL_INTERNAL ?? `http://127.0.0.1:${process.env.API_PORT ?? 5100}`;
const crm = process.env.CRM_INTERNAL_URL ?? `http://127.0.0.1:${process.env.CRM_PORT ?? 5103}`;
for (const base of [api, crm]) {
  const r = await fetch(`${base}/test/reset`, { method: "POST" });
  console.log(base, r.status, await r.text());
  if (!r.ok) process.exitCode = 1;
}
