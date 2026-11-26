// spec: specs/letters.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { reset, adminLogin, portalLogin, createLetter, newSession } from "./helpers";

test.describe("Letters", () => {
  test.beforeEach(async () => {
    await reset();
  });

  test("S2 Create and publish letter, Alice sees it in portal", async ({ page, browser }) => {
    const title = "Welcome for Alice";
    const body = "Hello Alice, welcome aboard.";

    // 1. Sign in to admin as admin@example.test / admin-pass-1.
    await adminLogin(page);

    // 2. Create a new letter titled 'Welcome for Alice' addressed to Alice with a body, and save.
    await createLetter(page, title, body, "Alice");
    const row = page.locator("tr, li").filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/draft/i);

    // 3. Click Publish (the publish action).
    await row.getByRole("button", { name: "Publish" }).click();
    await expect(row).toContainText(/rendering/i);

    // 4. Wait up to ~10s for the render.
    await expect(row).toContainText(/ready/i, { timeout: 15_000 });

    // 5. In a second browser context/session open the portal and sign in as alice.
    const alice = await newSession(browser);
    try {
      await portalLogin(alice.page, "alice");

      // 6. Open the 'Welcome for Alice' letter from the inbox.
      await alice.page.getByText(title).first().click();
      await expect(alice.page.getByText(title).first()).toBeVisible();
      await expect(alice.page.getByText(body)).toBeVisible();
    } finally {
      await alice.context.close();
    }
  });
});
