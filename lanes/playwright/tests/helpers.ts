import { expect, type Browser, type Page } from "@playwright/test";

const off = Number(process.env.PORT_OFFSET ?? 0);
export const urls = {
  api: `http://api.localhost:${5100 + off}`,
  admin: `http://admin.localhost:${5101 + off}`,
  portal: `http://portal.localhost:${5102 + off}`,
  crm: `http://crm.localhost:${5103 + off}`,
};

/** Reset api + crm to seed state. */
export async function reset() {
  for (const base of [urls.api, urls.crm]) {
    const r = await fetch(`${base}/test/reset`, { method: "POST" });
    if (!r.ok) throw new Error(`reset ${base} -> ${r.status}`);
  }
}

export async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** A fresh, isolated browser context (own cookies/localStorage) for a second session. */
export async function newSession(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

export async function adminLogin(page: Page, query = "") {
  await page.goto(urls.admin + query);
  await signIn(page, "admin@example.test", "admin-pass-1");
  await expect(page.getByRole("heading", { name: "Letters Admin" })).toBeVisible();
}

export async function portalLogin(page: Page, who: "alice" | "bob") {
  await page.goto(urls.portal);
  await signIn(page, `${who}@example.test`, `${who}-pass-1`);
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
}

export async function createLetter(page: Page, title: string, body: string, recipient = "Alice") {
  const form = page.getByRole("form", { name: "New letter" });
  await form.getByLabel("Title").fill(title);
  await form.getByLabel("Body").fill(body);
  await form.getByLabel("Recipient").selectOption({ label: `${recipient} Portal (${recipient.toLowerCase()}@example.test)` });
  await form.getByRole("button", { name: "Create letter" }).click();
}
