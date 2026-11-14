import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, APP_URL, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// Help from Nevermore (story CRM-P2.4, decisions D-16, D-27, D-33). A platform admin, who belongs to no firm, starts one hour of support
// access to a firm from the platform's Firms page, giving a reason; at the firm's address they read its submissions under a banner and
// can change nothing (adding a referral partner is refused in plain words); ending it keeps them out and the page says the hour has
// ended; and the firm's owner reads each use in the firm's record as Nevermore, with the reason and without who.
// The password sign-in is the one this gateway stands in for, so the second factor is set up on the way, as in the other firm flows.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `support-${stamp}`;
const NAME = `Support ${stamp} Co`;
const REASON = "Customer asked us to look at a stuck quote";

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

/** Signs in with the password and sets up the second factor; returns its secret, which a later sign-in at another address needs. */
async function signInAndAddSecondFactor(page: Page, url: string, email: string): Promise<string> {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Add a second step to your sign-in" })).toBeVisible();
  const secret = (await page.locator("span.font-mono").innerText()).trim();
  await page.getByLabel(/6-digit code/).fill(totpCode(secret));
  await page.getByRole("button", { name: "Turn on and continue" }).click();
  return secret;
}

/** Signs in at an address the account has a second factor for already (each address has its own session). */
async function signInWithSecondFactor(page: Page, url: string, email: string, secret: string) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
  await page.getByLabel(/6-digit code/).fill(totpCode(secret));
  await page.getByRole("button", { name: "Continue" }).click();
}

test("an admin starts support access with a reason, reads a submission and can change nothing, ends it and is kept out; the owner reads it as Nevermore with the reason", async ({ browser, request }) => {
  const adminEmail = `support-admin-${stamp}@example.test`;
  const ownerEmail = `support-owner-${stamp}@example.test`;
  const adminId = await newUser(request, adminEmail);
  const ownerId = await newUser(request, ownerEmail);
  const prospect = await newUser(request, `support-prospect-${stamp}@example.test`);
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, decision, decided_at, visibility) VALUES ($1, $2, now(), 'approved', now(), 'everyone') RETURNING id", [NAME, FIRM]);
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner')", [firm.rows[0].id, ownerId]);
    await client.query("INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ($1, $2, '{\"company_name\":\"Looked At Co\"}')", [prospect, firm.rows[0].id]);
    await client.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')", [adminId]);
  });

  const adminPage = await (await browser.newContext()).newPage();
  const ownerPage = await (await browser.newContext()).newPage();
  let secret = "";

  await test.step("the admin, who belongs to no firm, is asked for a reason on the Firms page and told it lasts one hour and the owners will read it", async () => {
    secret = await signInAndAddSecondFactor(adminPage, `${APP_URL}/advisor/firms`, adminEmail);
    await expect(adminPage.getByRole("heading", { name: "Firm approvals" })).toBeVisible();
    await adminPage.getByRole("button", { name: `Support access to ${NAME}` }).click();
    const item = adminPage.getByRole("list", { name: "Every firm" }).getByRole("listitem").filter({ hasText: NAME });
    await expect(item).toContainText("for one hour");
    await expect(item).toContainText("The firm's owners will see this reason");
    await expect(item.getByRole("button", { name: "Start support access" })).toBeDisabled();
    await adminPage.getByLabel(`Reason for support access to ${NAME}`).fill(REASON);
    await item.getByRole("button", { name: "Start support access" }).click();
    const open = adminPage.getByRole("list", { name: "Open support access" }).getByRole("listitem").filter({ hasText: NAME });
    await expect(open).toContainText("Ends at");
    await expect(open).toContainText(REASON);
    await expect(open.getByRole("link", { name: `Open ${NAME}` })).toHaveAttribute("href", `${firmUrl(FIRM)}/advisor`);
  });

  await test.step("at the firm's address the admin reads a submission under a banner, as Nevermore support", async () => {
    await signInWithSecondFactor(adminPage, `${firmUrl(FIRM)}/advisor`, adminEmail, secret);
    const banner = adminPage.getByRole("status", { name: "Nevermore support" });
    await expect(banner).toContainText(`Nevermore support: you are looking at ${NAME}.`);
    await expect(banner).toContainText("You can't change anything.");
    await expect(banner).toContainText("Ends at");
    await expect(adminPage.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(adminPage.getByText("Looked At Co")).toBeVisible();
    await expect(adminPage.getByText("Nevermore support", { exact: true })).toBeVisible();
  });

  await test.step("the admin cannot add a referral partner: the refusal is shown in plain words and nothing is written", async () => {
    await adminPage.goto(`${firmUrl(FIRM)}/advisor/partners`);
    await expect(adminPage.getByRole("heading", { name: "Referral partners" })).toBeVisible();
    await adminPage.getByLabel("Name").fill("Sneaky Partners");
    await adminPage.getByLabel("Kind of partner").selectOption({ index: 1 });
    await adminPage.getByLabel("Code in their link").fill("sneaky-partners");
    await adminPage.getByRole("button", { name: "Add partner" }).click();
    await expect(adminPage.getByText("Nevermore support can look, not change")).toBeVisible();
    await expect(adminPage.getByRole("cell", { name: "Sneaky Partners" })).toHaveCount(0);
    const kept = await withDb((client) => client.query("SELECT count(*)::int AS n FROM public.referral_partners WHERE firm_id = (SELECT id FROM public.firms WHERE address = $1)", [FIRM]));
    expect(kept.rows[0].n).toBe(0);
  });

  await test.step("the admin ends it from the banner, lands on the Firms page, and the firm's address now keeps them out and says the hour has ended", async () => {
    await adminPage.getByRole("button", { name: "End now" }).click();
    await expect(adminPage).toHaveURL(`${APP_URL}/advisor/firms`);
    await expect(adminPage.getByRole("list", { name: "Open support access" })).toHaveCount(0);
    await adminPage.goto(`${firmUrl(FIRM)}/advisor`);
    await expect(adminPage.getByRole("heading", { name: "The support hour has ended" })).toBeVisible();
    await expect(adminPage.getByRole("link", { name: "Back to the firms page" })).toHaveAttribute("href", `${APP_URL}/advisor/firms`);
    await expect(adminPage.getByText("Looked At Co")).toHaveCount(0);
    await expect(adminPage.getByRole("heading", { name: "Submissions" })).toHaveCount(0);
  });

  await test.step("the firm's owner reads the use in Activity as Nevermore, with the reason and when it started and ended, and no trace of who", async () => {
    await signInAndAddSecondFactor(ownerPage, `${firmUrl(FIRM)}/advisor/activity`, ownerEmail);
    const table = ownerPage.getByRole("table", { name: "Who did what" });
    await expect(table).toBeVisible();
    const started = table.getByRole("row").filter({ hasText: "Nevermore support opened your firm's console" });
    await expect(started).toContainText("Nevermore");
    await expect(started).toContainText(`Reason: ${REASON}`);
    const ended = table.getByRole("row").filter({ hasText: "Nevermore support's access ended" });
    await expect(ended).toContainText("Nevermore");
    await expect(ended).toContainText(REASON);
    await expect(ownerPage.getByText(adminEmail)).toHaveCount(0);
    await expect(ownerPage.getByText(adminId)).toHaveCount(0);
    await expect(ownerPage.getByLabel("Person").locator("option", { hasText: "Nevermore" })).toHaveCount(1);
  });

  await test.step("the platform keeps who, which firm, why and when; the firm's record holds the entries as Nevermore's; the monitoring table heard of the start", async () => {
    const rows = await withDb((client) => client.query(
      `SELECT s.admin_email, s.reason, s.ended_how, (s.ends_at - s.started_at = interval '1 hour') AS one_hour,
              (SELECT count(*)::int FROM public.firm_activity a WHERE a.firm_id = f.id AND a.kind = 'support_access' AND a.actor_is_staff) AS entries,
              (SELECT count(*)::int FROM public.ops_events e WHERE e.kind = 'support_access' AND e.user_id = s.admin_id) AS monitored
       FROM public.support_sessions s JOIN public.firms f ON f.id = s.firm_id WHERE f.address = $1`, [FIRM]));
    expect(rows.rows).toEqual([{ admin_email: adminEmail, reason: REASON, ended_how: "ended", one_hour: true, entries: 2, monitored: 1 }]);
  });
});
