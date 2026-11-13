import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// A second factor for password sign-ins (story CRM-P1.3b, decision D-19): an advisor who signs in with a password
// sets up an authenticator app, reaches the console, and at the next sign-in is asked for its code. The database
// refuses the password sign-in until then (supabase/tests/second_factor.sql covers every caller); here the same
// answer comes back over HTTP, through the gateway's stand-in for Supabase Auth.

const PASSWORD = "correct-horse-battery-staple";
const REST = `${GATEWAY_URL}/rest/v1`;

test("the stand-in's codes match RFC 6238's published example", () => {
  // RFC 6238 appendix B: the ASCII key "12345678901234567890" (base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ) at 59 seconds is 94287082; 6 digits keep its last six.
  expect(totpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
});

async function newAdvisor(request: APIRequestContext): Promise<string> {
  const email = `advisor-${Date.now()}@example.test`;
  const res = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email, password: PASSWORD } });
  expect(res.status()).toBe(200);
  const { user } = (await res.json()) as { user: { id: string } };
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    await client.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'advisor')", [user.id]);
  } finally {
    await client.end();
  }
  return email;
}

async function signInWithPassword(page: Page, email: string) {
  await page.goto("/advisor");
  await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
}

const isAdvisorOverApi = async (request: APIRequestContext, token: string) => {
  const res = await request.post(`${REST}/rpc/is_advisor`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }, data: {} });
  expect(res.status()).toBe(200);
  return (await res.json()) as boolean;
};

test("an advisor signs in with a password, sets up a second factor, reaches the console, and is asked for the code next time", async ({ page, request, browser }: { page: Page; request: APIRequestContext; browser: Browser }) => {
  const email = await newAdvisor(request);

  await test.step("a password sign-in alone opens nothing: the database says so over the API", async () => {
    const res = await request.post(`${GATEWAY_URL}/auth/v1/token?grant_type=password`, { headers: { apikey: ANON_KEY }, data: { email, password: PASSWORD } });
    expect(res.status()).toBe(200);
    const { access_token } = (await res.json()) as { access_token: string };
    expect(await isAdvisorOverApi(request, access_token)).toBe(false);
  });

  let secret = "";
  await test.step("the screen sends them to set up a second step, not to the console", async () => {
    await signInWithPassword(page, email);
    await expect(page.getByRole("heading", { name: "Add a second step to your sign-in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Submissions" })).toHaveCount(0);
    secret = (await page.locator("span.font-mono").innerText()).trim();
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  });

  await test.step("a code from the authenticator app turns it on and opens the console", async () => {
    await page.getByLabel(/6-digit code/).fill(totpCode(secret));
    await page.getByRole("button", { name: "Turn on and continue" }).click();
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(page).toHaveURL(/\/advisor$/);
  });

  await test.step("the next password sign-in asks for the code, and a wrong one opens nothing", async () => {
    const context = await browser.newContext();
    const later = await context.newPage();
    await signInWithPassword(later, email);
    await expect(later.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await later.getByLabel(/6-digit code/).fill(totpCode(secret, Date.now() + 10 * 60_000));
    await later.getByRole("button", { name: "Continue" }).click();
    await expect(later.getByRole("alert")).toContainText("That code didn't work");
    await expect(later.getByRole("heading", { name: "Submissions" })).toHaveCount(0);

    await later.getByLabel(/6-digit code/).fill(totpCode(secret));
    await later.getByRole("button", { name: "Continue" }).click();
    await expect(later.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await context.close();
  });
});
