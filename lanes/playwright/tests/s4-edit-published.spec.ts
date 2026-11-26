// spec: specs/letters.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { reset, adminLogin, portalLogin, createLetter, newSession } from "./helpers";

test.describe("Letters", () => {
  test.beforeEach(async () => {
    await reset();
  });

  test("S4 Edit published letter re-renders and Alice sees new body", async ({ page, browser }) => {
    const title = "Welcome for Alice";
    const oldBody = "Hello Alice, welcome aboard.";
    const newBody = "Updated body text";

    // 1. In admin, sign in, create letter 'Welcome for Alice' for Alice, publish and wait for ready.
    await adminLogin(page);
    await createLetter(page, title, oldBody, "Alice");
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Publish" }).click();
    await expect(row.getByRole("cell", { name: "ready" })).toBeVisible({ timeout: 15_000 });

    // 2. Edit the letter body to 'Updated body text' and save.
    await row.getByRole("button", { name: "Edit" }).click();
    const editForm = page.getByRole("form", { name: "Edit letter" });
    await editForm.getByLabel("Body").fill(newBody);
    await editForm.getByRole("button", { name: "Save changes" }).click();
    await expect(row.getByRole("cell", { name: "rendering" })).toBeVisible();

    // 3. Wait up to ~10s.
    await expect(row.getByRole("cell", { name: "ready" })).toBeVisible({ timeout: 15_000 });

    // 4. In a second session sign in to portal as Alice and open the letter from inbox.
    const alice = await newSession(browser);
    try {
      await portalLogin(alice.page, "alice");
      await alice.page.getByRole("link", { name: title }).click();
      const content = alice.page.getByRole("article", { name: "Letter content" });
      await expect(content).toHaveText(newBody);
      await expect(alice.page.getByText(oldBody)).toHaveCount(0);
    } finally {
      await alice.context.close();
    }
  });
});
