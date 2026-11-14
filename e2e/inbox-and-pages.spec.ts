import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, APP_URL, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// The queue on the table frame (story CRM-S3.5a, D-38, D-133). A member whose firm has 52 submissions, one of them with new PEO mail
// from a PEO: the menu's Inbox badge says 1, Inbox opens the queue filtered to exactly that one row, "All statuses" brings every
// submission back, and the browser's Back returns to the Inbox. The whole queue pages 50 a page ("1 to 50 of 52"), with Next and
// Previous as links, and the address says where the person is.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `inbox-${stamp}`;

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

test("the Inbox badge and the rows Inbox opens agree, and the queue pages 50 a page with Back working", async ({ page, request }) => {
  const member = `inbox-agent-${stamp}@example.test`;
  const memberId = await newUser(request, member);
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Inbox Advisory', $1, now(), 'everyone') RETURNING id", [FIRM]);
    const firmId = firm.rows[0].id as string;
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'agent')", [firmId, memberId]);
    // Fifty-two submissions, one per prospect (an account can hold one open draft). Two are the ones the test names.
    for (let i = 1; i <= 52; i++) {
      const prospect = await newUser(request, `inbox-prospect-${i}-${stamp}@example.test`);
      const name = i === 1 ? "Mail Waiting Co" : i === 2 ? "Quiet Co" : `Filler Co ${String(i).padStart(2, "0")}`;
      const session = await client.query(
        "INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ($1, $2, $3) RETURNING id",
        [prospect, firmId, JSON.stringify({ company_name: name })],
      );
      if (i === 1) {
        // Sent to a PEO, which has written back and nobody has opened the thread: the queue's "has new PEO mail".
        const q = await client.query("INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES ($1, 'TriNet', 'sent', current_date - 1) RETURNING id", [session.rows[0].id]);
        await client.query(
          "INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id) VALUES ($1, $2, $3, 'received', 'rep@trinet.test', now() - interval '1 hour', $4)",
          [`inbox-${stamp}`, q.rows[0].id, session.rows[0].id, firmId],
        );
      }
    }
  });

  await test.step("the member signs in and the menu's Inbox says 1", async () => {
    await signInAndAddSecondFactor(page, `${firmUrl(FIRM)}/advisor`, member);
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Inbox, 1 with new mail" })).toBeVisible();
  });

  await test.step("the whole queue pages 50 a page, with Next and Previous as links", async () => {
    await expect(page.getByText("1 to 50 of 52")).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(51);
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(page.getByText("51 to 52 of 52")).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(3);
    await page.goBack();
    await expect(page.getByText("1 to 50 of 52")).toBeVisible();
  });

  await test.step("Inbox opens exactly the one row with new PEO mail, and the menu marks Inbox", async () => {
    await page.getByRole("link", { name: "Inbox, 1 with new mail" }).click();
    await expect(page).toHaveURL(/\?filter=has_new_peo_mail:is:true$|\?filter=has_new_peo_mail%3Ais%3Atrue$/);
    await expect(page.getByText("1 to 1 of 1")).toBeVisible();
    await expect(page.getByRole("link", { name: "Mail Waiting Co" })).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByText("Quiet Co")).toHaveCount(0);
    await expect(page.getByText("Showing every submission")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Inbox, 1 with new mail" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: /^Quotes/ })).not.toHaveAttribute("aria-current", "page");
  });

  await test.step("Quotes shows every submission again, and Back returns to the Inbox", async () => {
    await page.getByRole("link", { name: /^Quotes/ }).click();
    await expect(page.getByText("1 to 50 of 52")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Quotes/ })).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page.getByText("1 to 1 of 1")).toBeVisible();
    await expect(page.getByRole("link", { name: "Mail Waiting Co" })).toBeVisible();
  });

  await test.step("the old Inbox link (mail=new) still lands on the same row, and the address is rewritten", async () => {
    await page.goto(`${firmUrl(FIRM)}/advisor?mail=new`);
    await expect(page.getByRole("link", { name: "Mail Waiting Co" })).toBeVisible();
    await expect(page.getByText("1 to 1 of 1")).toBeVisible();
    await expect(page).toHaveURL(/filter=has_new_peo_mail/);
    expect(page.url()).not.toContain("mail=new");
  });
});
