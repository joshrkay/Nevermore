import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, APP_URL, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// One firm at a time (story CRM-S1.1b, decision D-40, ADR 0015). One person belongs to two firms. On the bare domain they are
// shown "Choose a firm", with a link to each firm's address. At firm A's address the browser names that address on every
// request to the database, the gateway hands the request's headers to Postgres as hosted PostgREST does, and the database
// answers for firm A alone: the submissions list holds A's and none of B's; at B's address, B's and none of A's. Without the
// header reaching the database the person would see both firms' submissions at either address.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM_A = `alder-${stamp}`;
const FIRM_B = `beech-${stamp}`;

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

async function signIn(page: Page, url: string, email: string) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("a member of two firms chooses a firm on the bare domain, and at each firm's address sees only that firm's submissions", async ({ page, request }) => {
  const email = `two-firms-${stamp}@example.test`;
  const memberId = await newUser(request, email);
  const prospectA = await newUser(request, `alder-prospect-${stamp}@example.test`);
  const prospectB = await newUser(request, `beech-prospect-${stamp}@example.test`);
  await withDb(async (client) => {
    const a = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Alder Advisory', $1, now(), 'everyone') RETURNING id", [FIRM_A]);
    const b = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Beech Brokers', $1, now(), 'everyone') RETURNING id", [FIRM_B]);
    // No platform role: a membership of each firm.
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $3, 'agent'), ($2, $3, 'owner')", [a.rows[0].id, b.rows[0].id, memberId]);
    await client.query("INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ($1, $2, '{\"company_name\":\"Alder Only Co\"}')", [prospectA, a.rows[0].id]);
    await client.query("INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ($1, $2, '{\"company_name\":\"Beech Only Co\"}')", [prospectB, b.rows[0].id]);
  });

  let secret = "";
  await test.step("on the bare domain they sign in and are shown \"Choose a firm\", linking to each firm's address", async () => {
    await signIn(page, `${APP_URL}/advisor`, email);
    await expect(page.getByRole("heading", { name: "Add a second step to your sign-in" })).toBeVisible();
    secret = (await page.locator("span.font-mono").innerText()).trim();
    await page.getByLabel(/6-digit code/).fill(totpCode(secret));
    await page.getByRole("button", { name: "Turn on and continue" }).click();
    await expect(page.getByRole("heading", { name: "Choose a firm" })).toBeVisible();
    await expect(page).toHaveURL(`${APP_URL}/choose-firm`);
    const firms = page.getByRole("list", { name: "Your firms" });
    await expect(firms.getByRole("link", { name: /Alder Advisory/ })).toHaveAttribute("href", `${firmUrl(FIRM_A)}/advisor`);
    await expect(firms.getByRole("link", { name: /Beech Brokers/ })).toHaveAttribute("href", `${firmUrl(FIRM_B)}/advisor`);
    await expect(page.getByText("Alder Only Co")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Submissions" })).toHaveCount(0);
  });

  await test.step("following firm A's link, they sign in there and see firm A's submission and none of firm B's", async () => {
    await page.getByRole("list", { name: "Your firms" }).getByRole("link", { name: /Alder Advisory/ }).click();
    await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`^${firmUrl(FIRM_A)}/`));
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await page.getByLabel(/6-digit code/).fill(totpCode(secret));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(page.getByText("Alder Only Co")).toBeVisible();
    await expect(page.getByText("Beech Only Co")).toHaveCount(0);
  });

  await test.step("at firm B's address, firm B's submission and none of firm A's", async () => {
    await signIn(page, `${firmUrl(FIRM_B)}/advisor`, email);
    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await page.getByLabel(/6-digit code/).fill(totpCode(secret));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(page.getByText("Beech Only Co")).toBeVisible();
    await expect(page.getByText("Alder Only Co")).toHaveCount(0);
  });

  await test.step("back at firm A's address, its own session still shows firm A's submission only", async () => {
    await page.goto(`${firmUrl(FIRM_A)}/advisor`);
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(page.getByText("Alder Only Co")).toBeVisible();
    await expect(page.getByText("Beech Only Co")).toHaveCount(0);
  });
});
