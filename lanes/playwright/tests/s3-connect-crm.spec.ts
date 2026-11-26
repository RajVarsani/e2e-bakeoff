// spec: specs/letters.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { reset, urls, portalLogin, signIn } from "./helpers";

test.describe("Letters", () => {
  test.beforeEach(async () => {
    await reset();
  });

  test("S3 Portal Alice connects CRM via OAuth and sees clients", async ({ page }) => {
    // 1. Open portal and sign in as alice@example.test / alice-pass-1.
    await portalLogin(page, "alice");

    // 2. Click Connect CRM.
    await page.getByRole("button", { name: "Connect CRM" }).click();
    await expect(page).toHaveURL(new RegExp(`^${urls.crm}/`));
    await expect(page.getByRole("heading", { name: "CRM sign in" })).toBeVisible();

    // 3. Sign in to crm as crm.user@example.test / crm-pass-1 if prompted, then click Allow.
    await signIn(page, "crm.user@example.test", "crm-pass-1");
    await expect(page.getByRole("heading", { name: "Authorize access" })).toBeVisible();
    await page.getByRole("button", { name: "Allow" }).click();
    await expect(page).toHaveURL(new RegExp(`^${urls.portal}/`));

    // 4. View the CRM clients on the portal.
    await expect(page.getByRole("status")).toHaveText("CRM connected");
    const clients = page.getByRole("list", { name: "CRM clients" });
    await expect(clients.getByRole("listitem")).toHaveCount(3);
    await expect(clients).toContainText("Jordan Lee");
    await expect(clients).toContainText("Sam Patel");
    await expect(clients).toContainText("Riley Chen");
  });
});
