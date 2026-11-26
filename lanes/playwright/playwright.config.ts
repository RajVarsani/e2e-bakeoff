import { defineConfig, devices } from "@playwright/test";

const off = Number(process.env.PORT_OFFSET ?? 0);
export default defineConfig({
  testDir: ".",
  testMatch: ["seed.spec.ts", "tests/**/*.spec.ts"],
  fullyParallel: false,
  workers: 1, // tests share one sqlite-backed stack and reset it per test
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: { timeout: 15_000 }, // render takes 2-6s; web-first assertions poll
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    baseURL: `http://admin.localhost:${5101 + off}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
