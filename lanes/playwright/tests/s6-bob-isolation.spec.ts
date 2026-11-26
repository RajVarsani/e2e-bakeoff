// spec: specs/letters.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { reset, adminLogin, portalLogin, createLetter, newSession, urls } from "./helpers";

test.describe("Letters", () => {
  test.beforeEach(async () => {
    await reset();
  });

  test("S6 Bob cannot access Alice's letter", async ({ page, browser }) => {
    const title = "Welcome for Alice";
    const body = "Hello Alice, welcome aboard.";

    // 1. In admin, create and publish 'Welcome for Alice' for Alice, wait for ready, and note the letter id.
    await adminLogin(page);
    await createLetter(page, title, body, "Alice");
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Publish" }).click();
    await expect(row.getByRole("cell", { name: "ready" })).toBeVisible({ timeout: 15_000 });

    const alice = await newSession(browser);
    let letterId: string;
    try {
      await portalLogin(alice.page, "alice");
      await alice.page.getByRole("link", { name: title }).click();
      await expect(alice.page).toHaveURL(/\/letters\/[^/]+$/);
      letterId = new URL(alice.page.url()).pathname.split("/").pop()!;
    } finally {
      await alice.context.close();
    }

    // 2. In a separate session sign in to portal as bob.
    const bob = await newSession(browser);
    try {
      await portalLogin(bob.page, "bob");
      await expect(bob.page.getByRole("heading", { name: "Inbox" })).toBeVisible();
      await expect(bob.page.getByRole("link", { name: title })).toHaveCount(0);
      await expect(bob.page.getByText(title)).toHaveCount(0);

      // 3. Navigate directly to the letter URL.
      await bob.page.goto(`${urls.portal}/letters/${letterId}`);
      await expect(bob.page.getByText("Letter not found")).toBeVisible();
      await expect(bob.page.getByRole("heading", { name: title })).toHaveCount(0);
      await expect(bob.page.getByText(body)).toHaveCount(0);
      await expect(bob.page.getByRole("article", { name: "Letter content" })).toHaveCount(0);
    } finally {
      await bob.context.close();
    }
  });
});
