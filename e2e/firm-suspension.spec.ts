import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, APP_URL, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// Suspending a firm and lifting the suspension (story CRM-P1.8, decisions D-16, D-27, D-33). A platform admin, who belongs to no firm,
// suspends a firm with a reason from the firms page; the firm's member, at the firm's address, is told it is suspended and sees nothing
// of the console, only a way to sign out; lifting the suspension brings the console back. The password sign-in is the one this gateway
// stands in for, so the second factor is set up on the way, as in the other firm flows.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `suspend-${stamp}`;

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

test("an admin suspends a firm and its member, at its address, sees the suspended page and no console; lifting brings the console back", async ({ browser, request }) => {
  const member = `suspend-member-${stamp}@example.test`;
  const admin = `suspend-admin-${stamp}@example.test`;
  const memberId = await newUser(request, member);
  const adminId = await newUser(request, admin);
  const prospect = await newUser(request, `suspend-prospect-${stamp}@example.test`);
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, decision, decided_at, visibility) VALUES ('Suspend Co', $1, now(), 'approved', now(), 'everyone') RETURNING id", [FIRM]);
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner')", [firm.rows[0].id, memberId]);
    await client.query("INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ($1, $2, '{\"company_name\":\"Kept Safe Co\"}')", [prospect, firm.rows[0].id]);
    await client.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')", [adminId]);
  });

  const memberPage = await (await browser.newContext()).newPage();
  const adminPage = await (await browser.newContext()).newPage();

  await test.step("the member signs in at the firm's address and reaches the console, with the firm's intake", async () => {
    await signInAndAddSecondFactor(memberPage, `${firmUrl(FIRM)}/advisor`, member);
    await expect(memberPage.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(memberPage.getByText("Kept Safe Co")).toBeVisible();
  });

  await test.step("the platform admin, who belongs to no firm, suspends the firm with a reason, after being asked to confirm", async () => {
    await signInAndAddSecondFactor(adminPage, `${APP_URL}/advisor`, admin);
    await expect(adminPage.getByRole("heading", { name: "You aren't a member of any firm" })).toBeVisible();
    await adminPage.goto(`${APP_URL}/advisor/firms`);
    await expect(adminPage.getByRole("heading", { name: "Firm approvals" })).toBeVisible();
    await adminPage.getByRole("button", { name: "Suspend Suspend Co" }).click();
    await expect(adminPage.getByRole("button", { name: "Yes, suspend" })).toBeDisabled();
    await adminPage.getByLabel("Reason for suspending Suspend Co").fill("Unpaid invoice");
    await adminPage.getByRole("button", { name: "Yes, suspend" }).click();
    const item = adminPage.getByRole("list", { name: "Every firm" }).getByRole("listitem").filter({ hasText: "Suspend Co" });
    await expect(item).toContainText("Suspended");
    await expect(item).toContainText("Unpaid invoice");
    await expect(item).toContainText("Approved");
  });

  await test.step("the member is told the firm is suspended, to contact Nevermore, and sees none of the console, lists or counts", async () => {
    await memberPage.goto(`${firmUrl(FIRM)}/advisor`);
    await expect(memberPage.getByRole("heading", { name: "Suspend Co is suspended" })).toBeVisible();
    await expect(memberPage.getByText(/contact Nevermore/i)).toBeVisible();
    await expect(memberPage.getByRole("heading", { name: "Submissions" })).toHaveCount(0);
    await expect(memberPage.getByRole("navigation", { name: "Console" })).toHaveCount(0);
    await expect(memberPage.getByText("Kept Safe Co")).toHaveCount(0);
    await memberPage.goto(`${firmUrl(FIRM)}/advisor/activity`);
    await expect(memberPage.getByRole("heading", { name: "Suspend Co is suspended" })).toBeVisible();
  });

  await test.step("the firm's data is untouched: nothing was deleted", async () => {
    const kept = await withDb((client) => client.query("SELECT count(*)::int AS n FROM public.chamber_sessions WHERE user_id = $1", [prospect]));
    expect(kept.rows[0].n).toBe(1);
  });

  await test.step("the firm's record shows the suspension as done by Nevermore, with no staff identity", async () => {
    const rows = await withDb((client) => client.query("SELECT kind, actor_is_staff FROM public.firm_activity WHERE kind IN ('firm_suspended', 'firm_restored') AND firm_id = (SELECT id FROM public.firms WHERE address = $1)", [FIRM]));
    expect(rows.rows).toEqual([{ kind: "firm_suspended", actor_is_staff: true }]);
  });

  await test.step("the admin lifts the suspension after being asked to confirm, and the member's console is back", async () => {
    await adminPage.getByRole("button", { name: "Lift suspension of Suspend Co" }).click();
    await adminPage.getByRole("button", { name: "Yes, lift" }).click();
    await expect(adminPage.getByRole("button", { name: "Suspend Suspend Co" })).toBeVisible();
    await memberPage.goto(`${firmUrl(FIRM)}/advisor`);
    await expect(memberPage.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(memberPage.getByText("Kept Safe Co")).toBeVisible();
  });
});
