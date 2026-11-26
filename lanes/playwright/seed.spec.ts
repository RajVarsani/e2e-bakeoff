import { test } from "@playwright/test";
import { reset, urls } from "./tests/helpers";

// Seed for the Playwright planner/generator: resets the stack, opens admin.
test("seed", async ({ page }) => {
  await reset();
  await page.goto(urls.admin);
});
