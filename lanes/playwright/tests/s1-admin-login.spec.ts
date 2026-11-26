// spec: specs/letters.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { reset, urls, signIn } from "./helpers";

test.describe("Letters", () => {
  test.beforeEach(async () => {
    await reset();
  });

  test("S1 Admin login: wrong password then correct login", async ({ page }) => {
    // 1. Start from seed state: admin app showing Sign in form.
    await page.goto(urls.admin);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    // 2. Enter admin@example.test and password 'wrong-pass', click Sign in.
    await signIn(page, "admin@example.test", "wrong-pass");
    await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Letters Admin" })).toHaveCount(0);

    // 3. Clear password, enter admin-pass-1, click Sign in.
    await page.getByLabel("Password").clear();
    await page.getByLabel("Password").fill("admin-pass-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Letters Admin" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in" })).toHaveCount(0);
  });
});
