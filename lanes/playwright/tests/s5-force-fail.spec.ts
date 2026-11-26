// spec: specs/letters.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { reset, adminLogin, portalLogin, createLetter, newSession } from "./helpers";

test.describe("Letters", () => {
  test.beforeEach(async () => {
    await reset();
  });

  test("S5 forceFail publish ends failed with Retry; Alice inbox shows failed", async ({ page, browser }) => {
    const title = "Welcome for Alice";

    // 1. Sign in to admin with forceFail=1 and create letter 'Welcome for Alice' for Alice.
    await adminLogin(page, "/?forceFail=1");
    await createLetter(page, title, "Hello Alice, welcome aboard.", "Alice");
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row.getByRole("cell", { name: "draft" })).toBeVisible();

    // 2. Click Publish (the publish action).
    await row.getByRole("button", { name: "Publish" }).click();
    await expect(row.getByRole("cell", { name: "rendering" })).toBeVisible();

    // 3. Wait up to ~10s.
    await expect(row.getByRole("cell", { name: "failed" })).toBeVisible({ timeout: 15_000 });
    await expect(row.getByRole("button", { name: "Retry" })).toBeVisible();

    // 4. In a second session sign in to portal as alice@example.test / alice-pass-1.
    const alice = await newSession(browser);
    try {
      await portalLogin(alice.page, "alice");
      const inboxRow = alice.page.getByRole("row").filter({ hasText: title });
      await expect(inboxRow.getByRole("cell", { name: "failed" })).toBeVisible();
      await expect(alice.page.getByRole("link", { name: title })).toHaveCount(0); // not openable
    } finally {
      await alice.context.close();
    }
  });
});
