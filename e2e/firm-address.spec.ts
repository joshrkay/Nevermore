import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// The firm address (story CRM-P1.3a, decisions D-17 and D-18): the host chooses the firm, the database decides who
// gets in. A member signs in at their firm's address and reaches the console; at another firm's address the same
// person has no session, signs in again, and is told they aren't a member. An address nobody holds is not found.
// The password sign-in is the one this gateway stands in for, so the second factor (CRM-P1.3b) is set up on the way.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const HOME = `harborside-${stamp}`;
const OTHER = `birchwood-${stamp}`;
const NOWHERE = `nowhere-${stamp}`;

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** Two approved firms, and an advisor who is a member of the first only. */
async function setUp(request: APIRequestContext): Promise<string> {
  const email = `member-${stamp}@example.test`;
  const res = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email, password: PASSWORD } });
  expect(res.status()).toBe(200);
  const { user } = (await res.json()) as { user: { id: string } };
  await withDb(async (client) => {
    const home = await client.query("INSERT INTO public.firms (name, address, approved_at) VALUES ('Harborside Benefits', $1, now()) RETURNING id", [HOME]);
    await client.query("INSERT INTO public.firms (name, address, approved_at) VALUES ('Birchwood Brokers', $1, now())", [OTHER]);
    await client.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'advisor')", [user.id]);
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'agent')", [home.rows[0].id, user.id]);
  });
  return email;
}

async function signInWithPassword(page: Page, address: string, email: string) {
  await page.goto(`${firmUrl(address)}/advisor`);
  await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("a member signs in at their firm's address and reaches the console; at another firm's address they are told they aren't a member", async ({ page, request }) => {
  const email = await setUp(request);

  await test.step("an address no firm holds shows a plain not-found page: no sign-in is offered", async () => {
    await page.goto(`${firmUrl(NOWHERE)}/advisor`);
    await expect(page.getByText("Oops! Page not found")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toHaveCount(0);
    await expect(page.getByTestId("firm-name")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  });

  await test.step("the sign-in at the firm's address names the firm", async () => {
    await page.goto(`${firmUrl(HOME)}/advisor`);
    await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
    await expect(page.getByText("Harborside Benefits")).toBeVisible();
  });

  await test.step("a member signs in and reaches the console", async () => {
    await signInWithPassword(page, HOME, email);
    await expect(page.getByRole("heading", { name: "Add a second step to your sign-in" })).toBeVisible();
    const secret = (await page.locator("span.font-mono").innerText()).trim();
    await page.getByLabel(/6-digit code/).fill(totpCode(secret));
    await page.getByRole("button", { name: "Turn on and continue" }).click();
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`^${firmUrl(HOME)}/advisor$`));
  });

  await test.step("at another firm's address the same person has no session: they sign in again and aren't a member", async () => {
    await page.goto(`${firmUrl(OTHER)}/advisor`);
    await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
    await expect(page.getByText("Birchwood Brokers")).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "You aren't a member of this firm" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Submissions" })).toHaveCount(0);
    await expect(page.getByText("Harborside Benefits")).toHaveCount(0);
  });

  await test.step("they can sign out of it, and are back at the sign-in", async () => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  });

  await test.step("their own firm's address is still signed in: the other address did not take it away", async () => {
    await page.goto(`${firmUrl(HOME)}/advisor`);
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
  });

  await test.step("and its session can still be renewed: the sign-out ended only the other address's session", async () => {
    // The access token outlives a sign-out for about an hour, so the page alone proves nothing. A refresh is what a
    // global sign-out would have revoked.
    const refreshToken = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
      return key ? (JSON.parse(localStorage.getItem(key) ?? "{}") as { refresh_token?: string }).refresh_token : undefined;
    });
    expect(refreshToken).toBeTruthy();
    const res = await request.post(`${GATEWAY_URL}/auth/v1/token?grant_type=refresh_token`, { headers: { apikey: ANON_KEY }, data: { refresh_token: refreshToken } });
    expect(res.status()).toBe(200);
  });
});

test("a member of a firm waiting for approval signs in at its address, which names the firm, and works there", async ({ page, request }) => {
  const waiting = `waiting-${stamp}`;
  const email = `waiting-member-${stamp}@example.test`;
  const res = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email, password: PASSWORD } });
  expect(res.status()).toBe(200);
  const { user } = (await res.json()) as { user: { id: string } };
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address) VALUES ('Waiting Brokers', $1) RETURNING id", [waiting]);
    await client.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'advisor')", [user.id]);
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner')", [firm.rows[0].id, user.id]);
  });

  await page.goto(`${firmUrl(waiting)}/advisor`);
  await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  await expect(page.getByText("Waiting Brokers")).toBeVisible();
  await signInWithPassword(page, waiting, email);
  await expect(page.getByRole("heading", { name: "Add a second step to your sign-in" })).toBeVisible();
  const secret = (await page.locator("span.font-mono").innerText()).trim();
  await page.getByLabel(/6-digit code/).fill(totpCode(secret));
  await page.getByRole("button", { name: "Turn on and continue" }).click();
  await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`^${firmUrl(waiting)}/advisor$`));
});
