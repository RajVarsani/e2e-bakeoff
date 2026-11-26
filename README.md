# e2e-bakeoff

Sandbox system-under-test for comparing e2e tools. Four apps on four origins (cross-domain by design). No e2e tests live on `main`; each tool lane adds its own on a branch. Shared scenarios are in [SCENARIOS.md](SCENARIOS.md).

| App | URL | Stack | Seeded credentials |
|---|---|---|---|
| api | http://api.localhost:5100 | Bun + Hono + bun:sqlite, in-process render worker | admin: `admin@example.test` / `admin-pass-1`; portal users: `alice@example.test` / `alice-pass-1`, `bob@example.test` / `bob-pass-1` |
| admin | http://admin.localhost:5101 | Vite + React + TS | admin account above |
| portal | http://portal.localhost:5102 | Vite + React + TS | alice or bob |
| crm | http://crm.localhost:5103 | Hono server-rendered pages (login, consent), own sqlite and users | `crm.user@example.test` / `crm-pass-1` (clients: Jordan Lee, Sam Patel, Riley Chen) |

OAuth client registered at the crm: `portal-app` / `portal-secret`, redirect `http://portal.localhost:5102/crm/callback`.

| Task | Command |
|---|---|
| Install | `bun install` |
| Configure (optional) | `cp .env.example .env` |
| Boot all four | `bun run start` (sets `TEST_MODE=1` if unset) |
| Reset api + crm to seed state | `bun run reset` |
| Typecheck | `bun run typecheck` |

| Env | Effect |
|---|---|
| `TEST_MODE=1` | Enables `POST /test/reset`, `POST /test/seed`, and the `?forceFail=1` hook on publish and edit |
| `PORT_OFFSET=N` | Adds N to every port (api 5100+N ... crm 5103+N); all URLs, CORS, OAuth redirect and sqlite file names (`data-N.db`, `crm-N.db`) follow; computed in `ports.ts`. Read by start, reset and the Vite configs. URLs in this README show offset 0 |
| `FLAKY=1` | About 10% of renders end `failed` |

API notes: bearer-token sessions (`POST /auth/login`), letters CRUD under `/letters` (admin), recipient inbox at `/inbox` (portal), CRM connection at `/crm/*`. Render takes a random 2 to 6 seconds (`draft` or `rendering` then `ready` or `failed`). `POST /test/seed` takes `{"letters":[{"title","body","recipientEmail","status":"draft"|"ready"}]}`. Deterministic failure: open the admin app with `?forceFail=1` (publish and edit then call the API with `forceFail=1`), or call `POST /letters/:id/publish?forceFail=1` directly. Requires bun 1.2+ and `*.localhost` resolving to loopback (default in Chrome, Firefox, Safari, curl).
