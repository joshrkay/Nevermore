import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// Asking to close a firm and taking the request back (story CRM-P1.7, decisions D-18, D-27). An owner asks from Settings, after typing the
// firm's name; a member, in a browser of their own at the firm's address, sees a banner saying when it closes and that nothing can be
// changed, and adding a referral partner is refused with a plain message; the owner withdraws the request and the member can add one again.
// The password sign-in is the one this gateway stands in for, so the second factor is set up on the way, as in the other firm flows.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `closing-${stamp}`;

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function newUser(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email, password: PASSWORD } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { user: { id: string } }).user.id;
}

async function signInAndAddSecondFactor(page: Page, url: string, email: string) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Add a second step to your sign-in" })).toBeVisible();
  const secret = (await page.locator("span.font-mono").innerText()).trim();
  await page.getByLabel(/6-digit code/).fill(totpCode(secret));
  await page.getByRole("button", { name: "Turn on and continue" }).click();
}

async function addPartner(page: Page, name: string, code: string) {
  await page.goto(`${firmUrl(FIRM)}/advisor/partners`);
  await expect(page.getByRole("heading", { name: "Referral partners" })).toBeVisible();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Kind of partner").selectOption({ index: 1 });
  await page.getByLabel("Code in their link").fill(code);
  await page.getByRole("button", { name: "Add partner" }).click();
}

test("an owner asks to close the firm, a member sees the banner and can't change anything, and withdrawing gives the firm back", async ({ browser, request }) => {
  const ownerEmail = `closing-owner-${stamp}@example.test`;
  const memberEmail = `closing-agent-${stamp}@example.test`;
  const ownerId = await newUser(request, ownerEmail);
  const memberId = await newUser(request, memberEmail);
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Closing Co', $1, now(), 'approved', now()) RETURNING id", [FIRM]);
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'agent')", [firm.rows[0].id, ownerId, memberId]);
  });

  const ownerPage = await (await browser.newContext()).newPage();
  const memberPage = await (await browser.newContext()).newPage();

  await test.step("the member signs in at the firm's address and adds a referral partner, as they always could", async () => {
    await signInAndAddSecondFactor(memberPage, `${firmUrl(FIRM)}/advisor`, memberEmail);
    await expect(memberPage.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(memberPage.getByRole("status", { name: "This firm is closing" })).toHaveCount(0);
    await addPartner(memberPage, "First Partners", "first-partners");
    await expect(memberPage.getByRole("cell", { name: "First Partners" })).toBeVisible();
  });

  await test.step("an owner asks to close the firm from Settings, and is told what will happen before typing the firm's name", async () => {
    await signInAndAddSecondFactor(ownerPage, `${firmUrl(FIRM)}/settings`, ownerEmail);
    await ownerPage.getByRole("button", { name: "Close this firm" }).click();
    const dialog = ownerPage.getByRole("alertdialog");
    await expect(dialog).toContainText("For the next 30 days Closing Co is read-only");
    await expect(dialog).toContainText("After 30 days the firm's own working data is deleted for good");
    await expect(dialog).toContainText("can't be used by another firm for 12 months");
    await expect(dialog.getByRole("button", { name: "Close Closing Co in 30 days" })).toBeDisabled();
    await dialog.getByLabel(/Type the firm's name to confirm/).fill("Closing Co");
    await dialog.getByRole("button", { name: "Close Closing Co in 30 days" }).click();
    await expect(ownerPage.getByRole("heading", { name: "This firm is closing" })).toBeVisible();
    await expect(ownerPage.getByRole("status", { name: "This firm is closing" })).toContainText("nothing can be changed");
  });

  await test.step("the request is recorded for the firm, its owners are queued an email, and the firm closes in 30 days", async () => {
    const rows = await withDb((client) => client.query(
      `SELECT (SELECT count(*)::int FROM public.firm_activity a WHERE a.firm_id = f.id AND a.kind = 'closure_asked') AS asked,
              (SELECT count(*)::int FROM public.outbox_events e WHERE e.firm_id = f.id AND e.kind = 'firm_closing') AS emails,
              (SELECT (c.closes_at - c.asked_at = interval '30 days') FROM public.firm_closures c WHERE c.firm_id = f.id) AS thirty
       FROM public.firms f WHERE f.address = $1`, [FIRM]));
    expect(rows.rows).toEqual([{ asked: 1, emails: 1, thirty: true }]);
  });

  await test.step("the member sees the banner on a page, can still read, and adding a partner is refused in plain words", async () => {
    await memberPage.goto(`${firmUrl(FIRM)}/advisor/partners`);
    const banner = memberPage.getByRole("status", { name: "This firm is closing" });
    await expect(banner).toContainText("Closing Co closes on");
    await expect(banner).toContainText("nothing can be changed, added, sent or deleted");
    await expect(memberPage.getByRole("cell", { name: "First Partners" })).toBeVisible();
    await addPartner(memberPage, "Second Partners", "second-partners");
    await expect(memberPage.getByText("This firm is closing and can't be changed")).toBeVisible();
    await expect(memberPage.getByRole("cell", { name: "Second Partners" })).toHaveCount(0);
    const kept = await withDb((client) => client.query("SELECT count(*)::int AS n FROM public.referral_partners WHERE firm_id = (SELECT id FROM public.firms WHERE address = $1)", [FIRM]));
    expect(kept.rows[0].n).toBe(1);
  });

  await test.step("the owner withdraws the request, and the member can add a partner again", async () => {
    await ownerPage.goto(`${firmUrl(FIRM)}/settings`);
    await ownerPage.getByRole("button", { name: "Withdraw the request to close" }).click();
    await expect(ownerPage.getByRole("button", { name: "Close this firm" })).toBeVisible();
    await memberPage.goto(`${firmUrl(FIRM)}/advisor/partners`);
    await expect(memberPage.getByRole("status", { name: "This firm is closing" })).toHaveCount(0);
    await addPartner(memberPage, "Second Partners", "second-partners");
    await expect(memberPage.getByRole("cell", { name: "Second Partners" })).toBeVisible();
    const record = await withDb((client) => client.query(
      `SELECT (SELECT count(*)::int FROM public.firm_activity a WHERE a.firm_id = f.id AND a.kind = 'closure_withdrawn') AS withdrawn,
              (SELECT count(*)::int FROM public.referral_partners p WHERE p.firm_id = f.id) AS partners
       FROM public.firms f WHERE f.address = $1`, [FIRM]));
    expect(record.rows).toEqual([{ withdrawn: 1, partners: 2 }]);
  });
});
