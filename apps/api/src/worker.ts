import { db } from "./db";

// Finishes renders whose render_at has passed. FLAKY=1 fails ~10%; force_fail always fails.
setInterval(() => {
  const due = db.query("SELECT id, body, version, force_fail FROM letters WHERE status = 'rendering' AND render_at <= ?").all(Date.now()) as
    { id: number; body: string; version: number; force_fail: number }[];
  for (const l of due) {
    const fail = l.force_fail === 1 || (process.env.FLAKY === "1" && Math.random() < 0.1);
    if (fail) db.query("UPDATE letters SET status = 'failed', updated_at = ? WHERE id = ?").run(Date.now(), l.id);
    else db.query("UPDATE letters SET status = 'ready', rendered_body = ?, rendered_version = ?, updated_at = ? WHERE id = ?")
      .run(l.body, l.version, Date.now(), l.id);
  }
}, 250);
