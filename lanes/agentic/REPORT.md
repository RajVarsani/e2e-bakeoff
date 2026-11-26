# Lane: agentic browser (Stagehand 4.5.0, claude-sonnet-5-5)

| metric | value | note |
|---|---|---|
| tool | `@browserbasehq/stagehand` 4.5.0 (TS), local Playwright Chromium, model `claude-sonnet-5-5` | Stagehand v4 exposes `act`/`extract`/`observe` only (no `agent()`); zod schemas for assertions. browser-use fallback not needed |
| scenarios passing (S1-S6) | 6/6 | assertions are zod `extract` results compared in code, no selectors |
| local run time | ~228 s per full run (215-244 s, 11 runs) | S1 ~24 s, S2 ~63 s, S3 ~35 s, S4 ~41 s, S5 ~64 s, S6 ~14 s; ~80 LLM calls, serial, 2-4 s each |
| 10-run pass rate | 10/10 scenarios-suites green (60/60 scenario passes), plus 1 earlier green run | determinism held on this app; sample is small, no FLAKY=1 |
| tokens and $ per run | ~145k input, ~5.8k output (~80 calls); ~$0.52 | $ assumes $3/$15 per MTok for the Sonnet class (price not verified); ~$5 for the 10-run batch |
| CI run time | CI_TIME | |
| CI result | CI_RESULT | |
| setup effort | ~1.5 h to author and get stable | ~250 lines TS. Lost time on (a) Stagehand v4 needs a non-headless-shell Chromium with extension support (`executablePath` to Playwright Chromium, `--headless` new mode) or init hangs 60 s, (b) `act` does one action per call, so form fills are several steps |
| upkeep probe | FAIL, 2 of 3 scenarios broke | Renamed admin "Publish" button to "Send now": S2 and S5 failed with "No action found" for step `click Publish...`; S4 unaffected. Natural-language steps still name labels, so a rename needs the step text edited (no selector, but not self-healing for intent drift) |
| false-pass probe | caught | Portal letter view changed to render "Lorem ipsum wrong text": S2 and S4 failed on the body assertion. Extract returned the literal text, no hallucinated pass. Weakness: assertions are only as strict as the schema asked for |
| async-wait handling | polling `extract` until a predicate holds (1.5 s interval, 20-25 s cap), no fixed sleeps | Each poll costs one LLM call (~1.4k tokens). S2 asserts a non-ready state was observed before `ready`. S4 cannot reliably observe the `rendering` state: an extract takes about 3 s against a 2-6 s render, and the first poll may see the stale `ready`, so S4 relies on the portal showing the new body |
| cross-origin / multi-session | works | Two Stagehand instances = two Chrome profiles (admin + portal sessions) with no shared cookies. Portal to crm to portal OAuth worked on one page; origin checked via `page.url()` (the one non-agentic assertion) |
| DX notes | slow feedback (4 min suite), act granularity is per-action, error text from act is terse, token spend scales with polling, results depend on a vendor model/price. Pros: zero selectors, readable steps, survives DOM/markup changes | Credentials typed via act instruction go to the model (test creds only). `reset` and `seed` use the API directly |
| blockers / app bugs | none | |
