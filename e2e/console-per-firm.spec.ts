import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, APP_URL, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// The console per firm (story P-1.4, decisions D-15, D-16, D-18). A member of firm B, at firm B's address, sees none of firm
// A's submissions in the list and gets a plain not-found on a firm A submission's address; the database is the lock, and
// the person holds no platform role at all, which the console no longer asks about. A platform admin who belongs to no
// firm doesn't get a firm's console (D-16). The password sign-in is the one this gateway stands in for, so the second
// factor (CRM-P1.3b) is set up on the way, as in the other firm flows.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM_A = `alpha-${stamp}`;
const FIRM_B = `bravo-${stamp}`;

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

test("a member of firm B, at firm B's address, sees none of firm A's submissions and gets not-found on one's address", async ({ page, request }) => {
  const member = `bravo-agent-${stamp}@example.test`;
  const memberId = await newUser(request, member);
  const prospectA = await newUser(request, `prospect-a-${stamp}@example.test`);
  const prospectB = await newUser(request, `prospect-b-${stamp}@example.test`);
  const alphaIntake = await withDb(async (client) => {
    const a = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Alpha Advisory', $1, now(), 'everyone') RETURNING id", [FIRM_A]);
    const b = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Bravo Brokers', $1, now(), 'everyone') RETURNING id", [FIRM_B]);
    // The member holds no platform role: only a membership in firm B.
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'agent')", [b.rows[0].id, memberId]);
    const alpha = await client.query(
      "INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ($1, $2, '{\"company_name\":\"Alpha Secret Co\"}') RETURNING id",
      [prospectA, a.rows[0].id],
    );
    await client.query("INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ($1, $2, '{\"company_name\":\"Bravo Own Co\"}')", [prospectB, b.rows[0].id]);
    return alpha.rows[0].id as string;
  });

  await test.step("the member signs in at firm B's address and reaches the console, with no platform role", async () => {
    await signInAndAddSecondFactor(page, `${firmUrl(FIRM_B)}/advisor`, member);
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    await expect(page.getByText("Bravo Brokers").first()).toBeVisible();
    await expect(page.getByText(`${FIRM_B}.nevermorepeo.com`)).toBeVisible();
  });

  await test.step("the list holds firm B's submission and none of firm A's", async () => {
    await expect(page.getByText("Bravo Own Co")).toBeVisible();
    await expect(page.getByText("Alpha Secret Co")).toHaveCount(0);
  });

  await test.step("firm A's submission, opened by its address, isn't available: not an error and not a spinner, with the way back to the list (CRM-S2.3)", async () => {
    await page.goto(`${firmUrl(FIRM_B)}/advisor/submissions/${alphaIntake}`);
    await expect(page.getByRole("heading", { name: "This submission isn't available." })).toBeFocused();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByText("Alpha Secret Co")).toHaveCount(0);
    // The same words for an id that was never a submission, so nothing tells a person which of the two it was.
    await page.goto(`${firmUrl(FIRM_B)}/advisor/submissions/not-a-submission`);
    await expect(page.getByRole("heading", { name: "This submission isn't available." })).toBeVisible();
    await page.getByRole("link", { name: "Back to all submissions" }).click();
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
  });

  await test.step("a list that can't be loaded says so in plain words, keeps the filters, and Try again loads it (CRM-S2.3)", async () => {
    await page.goto(`${firmUrl(FIRM_B)}/advisor?filter=needs_action:is:false`);
    await expect(page.getByText("Bravo Own Co")).toBeVisible();
    await page.route("**/rest/v1/rpc/queue_list_submissions", (route) => route.abort());
    await page.reload();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("We couldn't load the submissions.");
    await expect(alert).not.toContainText(/fetch|network|rpc|queue_list/i);
    await expect(page).toHaveURL(/filter=needs_action(:|%3A)is(:|%3A)false/);
    await page.unroute("**/rest/v1/rpc/queue_list_submissions");
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Bravo Own Co")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  await test.step("the menu offers the firm's pages and none of the platform's", async () => {
    await page.goto(`${firmUrl(FIRM_B)}/advisor`);
    const nav = page.getByRole("navigation", { name: "Workspace" });
    await expect(nav.getByRole("link", { name: "Quotes" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Held mail" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Firms" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Nevermore admin" })).toHaveCount(0);
    // The section links, and the firm's address as the firm's menu title, stay inside this firm.
    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${FIRM_B}.*/settings$`));
  });

  await test.step("the platform's pages are not the member's", async () => {
    for (const path of ["firms", "held"]) {
      await page.goto(`${firmUrl(FIRM_B)}/advisor/${path}`);
      await expect(page.getByRole("heading", { name: "For Nevermore's platform admins" })).toBeVisible();
    }
  });

  await test.step("the firm's record of who did what is for owners: an agent is turned away", async () => {
    await page.goto(`${firmUrl(FIRM_B)}/advisor/activity`);
    await expect(page.getByRole("heading", { name: "For a firm's owners" })).toBeVisible();
  });
});

test("a platform admin who is not a member of any firm doesn't get a firm's console, and the platform's pages are theirs", async ({ page, request }) => {
  const admin = `platform-admin-${stamp}@example.test`;
  const adminId = await newUser(request, admin);
  await withDb(async (client) => {
    await client.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')", [adminId]);
  });

  await signInAndAddSecondFactor(page, `${APP_URL}/advisor`, admin);

  await test.step("on the bare domain they are told they belong to no firm, in the words of a firm", async () => {
    await expect(page.getByRole("heading", { name: "You aren't a member of any firm" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Submissions" })).toHaveCount(0);
    await expect(page.getByText(/advisor|Waiting for access/i)).toHaveCount(0);
  });

  await test.step("the platform's own page, the firms waiting for approval, opens", async () => {
    await page.goto(`${APP_URL}/advisor/firms`);
    await expect(page.getByRole("heading", { name: "Firm approvals" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Held mail" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Submissions" })).toHaveCount(0);
  });
});
