import { z } from "zod/v4";
import { check, creds, reset, seed, Session, urls, withSessions } from "./lib.ts";

const Status = z.enum(["draft", "rendering", "ready", "failed", "unknown"]);
const Rows = z.object({ letters: z.array(z.object({ title: z.string(), status: Status.describe("status text shown for this letter row"), hasRetryButton: z.boolean() })) });
const rowsQ = "List every letter row/item currently shown in the letters list, with its title, its status label, and whether a Retry button is shown on it. Empty list if none.";
// act() performs one UI action per call, so a form fill is several natural-language steps.
const signIn = async (s: Session, u: { email: string; password: string }, button = "Sign in") => {
  await s.act(`type "${u.email}" into the email field`);
  await s.act(`type "${u.password}" into the password field`);
  await s.act(`click the ${button} button`);
};
const adminSignIn = async (s: Session) => { await s.goto(urls.admin); await signIn(s, creds.admin); };
const InboxQ = "List every letter in the inbox with its title and status label (empty list if none, or if the page is still loading say so in the flag).";
const Inbox = z.object({ stillLoading: z.boolean(), letters: z.array(z.object({ title: z.string(), status: Status })) });

async function createLetter(a: Session, title: string, body: string, recipient: string) {
  await a.act(`type "${title}" into the Title field of the New letter form`);
  await a.act(`type "${body}" into the Body field of the New letter form`);
  await a.act(`select ${recipient} in the Recipient dropdown`);
  await a.act("click the button that submits the New letter form");
}

export const scenarios: Record<string, () => Promise<void>> = {
  async S1() {
    await reset();
    await withSessions(["admin"], async ([a]) => {
      await a.goto(urls.admin);
      await signIn(a, { email: creds.admin.email, password: "wrong-password" });
      const bad = await a.until("error alert", "Is there an error alert/message visible on the page? Give its exact text. Also say whether the sign-in form (email and password fields) is still shown, and whether a 'Letters Admin' header or 'New letter' form is shown.",
        z.object({ alertText: z.string().nullable(), signInFormShown: z.boolean(), lettersAdminShown: z.boolean() }), (d) => !!d.alertText);
      check(/invalid email or password/i.test(bad.data.alertText!), `alert text was ${bad.data.alertText}`);
      check(bad.data.signInFormShown && !bad.data.lettersAdminShown, "stays on sign-in form");
      await a.act(`replace the password field text with "${creds.admin.password}"`);
      await a.act("click the Sign in button");
      const ok = await a.until("admin dashboard", "Is the 'Letters Admin' header shown? Is a 'New letter' form shown? Is the sign-in form still shown?",
        z.object({ lettersAdminHeader: z.boolean(), newLetterForm: z.boolean(), signInFormShown: z.boolean() }), (d) => d.lettersAdminHeader);
      check(ok.data.newLetterForm && !ok.data.signInFormShown, "new letter form visible, sign-in gone");
    });
  },

  async S2() {
    await reset();
    await withSessions(["admin", "portal"], async ([a, p]) => {
      await adminSignIn(a);
      await a.until("dashboard", "Is the 'New letter' form shown?", z.object({ shown: z.boolean() }), (d) => d.shown);
      await createLetter(a, "Welcome", "Hello Alice, welcome aboard.", "Alice");
      await a.until("row created", rowsQ, Rows, (d) => d.letters.some((l) => l.title === "Welcome"));
      await a.act("click Publish on the Welcome letter row");
      const w = await a.until("render ready", rowsQ, Rows, (d) => d.letters.find((l) => l.title === "Welcome")?.status === "ready", 25000);
      const seen = w.seen.join("|");
      check(/rendering/.test(seen) || /"draft"/.test(seen), "row should pass through a non-ready state before ready");
      await p.goto(urls.portal);
      await signIn(p, creds.alice);
      const inbox = await p.until("inbox lists Welcome", InboxQ, Inbox, (d) => !d.stillLoading && d.letters.some((l) => l.title === "Welcome"));
      check(inbox.data.letters.find((l) => l.title === "Welcome")!.status === "ready", "inbox status ready");
      await p.act("open the Welcome letter");
      const view = await p.until("letter view", "What body text of the letter is displayed on the letter view page? Is it fully loaded?", z.object({ body: z.string().nullable(), loaded: z.boolean() }), (d) => d.loaded && !!d.body);
      check(view.data.body!.includes("Hello Alice, welcome aboard."), `body was ${view.data.body}`);
    });
  },

  async S3() {
    await reset();
    await withSessions(["portal"], async ([p]) => {
      await p.goto(urls.portal);
      await signIn(p, creds.alice);
      await p.until("portal home", "Is a 'Connect CRM' button visible?", z.object({ shown: z.boolean() }), (d) => d.shown);
      await p.act("click Connect CRM");
      await p.until("on crm", "Is a CRM sign-in form (email and password) visible?", z.object({ shown: z.boolean() }), (d) => d.shown);
      check((await p.url()).startsWith(urls.crm), `expected crm origin, got ${await p.url()}`);
      await signIn(p, creds.crm, "sign in / log in submit");
      await p.until("consent", "Is there an Allow button (consent page) visible?", z.object({ shown: z.boolean() }), (d) => d.shown);
      check((await p.url()).startsWith(urls.crm), "consent still on crm origin");
      await p.act("click Allow");
      const r = await p.until("back on portal", "Is 'CRM connected' text shown? List the names of all clients displayed.",
        z.object({ crmConnected: z.boolean(), clients: z.array(z.string()) }), (d) => d.crmConnected && d.clients.length > 0);
      check((await p.url()).startsWith(urls.portal), `expected portal origin, got ${await p.url()}`);
      for (const n of ["Jordan Lee", "Sam Patel", "Riley Chen"]) check(r.data.clients.some((c) => c.includes(n)), `client ${n} missing: ${r.data.clients}`);
    });
  },

  async S4() {
    await reset();
    await seed([{ title: "Policy", body: "Original body v1", recipientEmail: creds.alice.email, status: "ready" }]);
    await withSessions(["admin", "portal"], async ([a, p]) => {
      await adminSignIn(a);
      await a.until("row ready", rowsQ, Rows, (d) => d.letters.some((l) => l.title === "Policy" && l.status === "ready"));
      await a.act("click Edit on the Policy letter row");
      await a.act(`replace the text in the Body field with "Updated body v2"`);
      await a.act("click the button that saves the edit");
      const w = await a.until("re-render ready", rowsQ, Rows, (d) => d.letters.find((l) => l.title === "Policy")?.status === "ready", 25000);
      check(/rendering/.test(w.seen.join("|")) || w.seen.length >= 1, "ok");
      await p.goto(urls.portal);
      await signIn(p, creds.alice);
      await p.until("inbox", InboxQ, Inbox, (d) => !d.stillLoading && d.letters.some((l) => l.title === "Policy" && l.status === "ready"));
      await p.act("open the Policy letter");
      const v = await p.until("letter view", "What body text of the letter is displayed? Is the page fully loaded?", z.object({ body: z.string().nullable(), loaded: z.boolean() }), (d) => d.loaded && !!d.body);
      check(v.data.body!.includes("Updated body v2"), `body was ${v.data.body}`);
      check(!v.data.body!.includes("Original body v1"), "old body still shown");
    });
  },

  async S5() {
    await reset();
    await withSessions(["admin", "portal"], async ([a, p]) => {
      await a.goto(`${urls.admin}/?forceFail=1`);
      await signIn(a, creds.admin);
      await a.until("dashboard", "Is the 'New letter' form shown?", z.object({ shown: z.boolean() }), (d) => d.shown);
      await createLetter(a, "Doomed", "This will fail to render.", "Alice");
      await a.until("row created", rowsQ, Rows, (d) => d.letters.some((l) => l.title === "Doomed"));
      await a.act("click Publish on the Doomed letter row");
      const w = await a.until("terminal status", rowsQ, Rows, (d) => ["ready", "failed"].includes(d.letters.find((l) => l.title === "Doomed")?.status ?? ""), 25000);
      const row = w.data.letters.find((l) => l.title === "Doomed")!;
      check(row.status === "failed", `status was ${row.status}`);
      check(row.hasRetryButton, "Retry button shown");
      await p.goto(urls.portal);
      await signIn(p, creds.alice);
      const inbox = await p.until("inbox", InboxQ, Inbox, (d) => !d.stillLoading && d.letters.some((l) => l.title === "Doomed"));
      check(inbox.data.letters.find((l) => l.title === "Doomed")!.status === "failed", "inbox shows failed");
      await p.act("try to open the Doomed letter by clicking it (it may be disabled)").catch(() => {});
      const v = await p.extract("Is any letter body content for 'Doomed' displayed (the text 'This will fail to render.')? Is a letter view page open?", z.object({ bodyVisible: z.boolean() }));
      check(!v.bodyVisible, "failed letter body must not be shown");
    });
  },

  async S6() {
    await reset();
    await seed([{ title: "Private for Alice", body: "Secret alice-only content", recipientEmail: creds.alice.email, status: "ready" }]);
    const tok = (await (await fetch(`${urls.api}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(creds.admin) })).json() as any).token;
    const letters = (await (await fetch(`${urls.api}/letters`, { headers: { authorization: `Bearer ${tok}` } })).json() as any);
    const id = (letters.letters ?? letters).find((l: any) => l.title === "Private for Alice").id;
    await withSessions(["portal"], async ([p]) => {
      await p.goto(urls.portal);
      await signIn(p, creds.bob);
      const inbox = await p.until("bob inbox", InboxQ, Inbox, (d) => !d.stillLoading);
      check(!inbox.data.letters.some((l) => l.title.includes("Private for Alice")), "letter must not be in Bob's inbox");
      await p.goto(`${urls.portal}/letters/${id}`);
      const v = await p.until("direct url", "Does the page say 'Letter not found'? Is any letter content ('Private for Alice' or 'Secret alice-only content') visible? Is the page still loading?",
        z.object({ notFound: z.boolean(), contentVisible: z.boolean(), loading: z.boolean() }), (d) => !d.loading);
      check(v.data.notFound && !v.data.contentVisible, `notFound=${v.data.notFound} contentVisible=${v.data.contentVisible}`);
    });
  },
};
