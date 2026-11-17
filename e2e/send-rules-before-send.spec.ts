import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";
import { agreeToIntakeConsentOverRest } from "./support/consent";

// What stops a send is said before Send is pressed (D-1910). A firm Nevermore has not approved, and a submission that is not yet Ready for market, used to be learned only after Send was pressed and the
// database refused. The send panel on the submission's page now says each, in the database's own words, and does not let the send go. The firm approved and the submission at Ready for market: nothing is said.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `send-rules-${stamp}`;

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

/** A certified submission, started at the firm's link and certified over REST as an employer would (the database's own checks apply). */
async function certifiedSubmissionInFirm(request: APIRequestContext, address: string): Promise<string> {
  const signup = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: {} });
  const { access_token: guestToken, user } = (await signup.json()) as { access_token: string; user: { id: string } };
  const email = `send-rules-employer-${stamp}@example.com`;
  await request.put(`${GATEWAY_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${guestToken}` }, data: { email } });
  const code = /\b\d{6}\b/.exec(await (await request.get(`${GATEWAY_URL}/__e2e/otp`, { params: { email } })).text())![0];
  const verify = await request.post(`${GATEWAY_URL}/auth/v1/verify`, { headers: { apikey: ANON_KEY }, data: { type: "email_change", email, token: code } });
  const { access_token: token } = (await verify.json()) as { access_token: string };
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" };
  await agreeToIntakeConsentOverRest(request, headers);
  // At the firm's own link (the address header the app sends from the firm's host), so the intake is the firm's from its start.
  const created = await request.post(`${GATEWAY_URL}/rest/v1/chamber_sessions?select=id`, { headers: { ...headers, "x-firm-address": address }, data: { user_id: user.id, chamber_data: {} } });
  const [{ id }] = (await created.json()) as { id: string }[];
  const data = { company_name: "Send Rules Bakery", states: ["NY"], pay_frequency: "weekly", employee_count: 12 };
  const certified = await request.patch(`${GATEWAY_URL}/rest/v1/chamber_sessions?id=eq.${id}&select=id,status`, {
    headers,
    data: {
      status: "submitted",
      chamber_data: data,
      submission: { signer_name: "Jo Doe", signer_title: "CEO", signed_at: new Date().toISOString(), consent_version: "2026-10-draft-1", consent_text: ["I certify."], chamber_data: data },
    },
  });
  expect(certified.status()).toBe(200);
  return id;
}

test("the send panel says a firm that isn't approved, and a submission that isn't Ready for market, can't send, before Send is pressed", async ({ page, request }) => {
  const member = `send-rules-${stamp}@example.test`;
  const memberId = await newUser(request, member);
  const firmId = await withDb(async (client) => {
    // Waiting for approval: it can work intakes and send nothing (D-1900).
    const firm = await client.query("INSERT INTO public.firms (name, address, visibility) VALUES ('Send Rules Advisory', $1, 'everyone') RETURNING id", [FIRM]);
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner')", [firm.rows[0].id, memberId]);
    // A PEO with a published profile, so there is someone to choose.
    const peo = await client.query("INSERT INTO public.peos (name) VALUES ('Justworks Send Rules') RETURNING id");
    await client.query(
      `INSERT INTO public.peo_profile_versions (peo_id, version, status, published_at, needed_to_quote, sources)
       VALUES ($1, 1, 'published', now(), ARRAY['company_name'], '{"answers": {"kind": "document", "name": "Quoting checklist", "checked_on": "2026-11-01"}}'::jsonb)`,
      [peo.rows[0].id],
    );
    return firm.rows[0].id as string;
  });
  const sessionId = await certifiedSubmissionInFirm(request, FIRM);

  await signInAndAddSecondFactor(page, `${firmUrl(FIRM)}/advisor`, member);
  await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();

  await test.step("a submission still Submitted, in a firm waiting for approval: both are said when the panel opens, with Review still there", async () => {
    await page.goto(`${firmUrl(FIRM)}/advisor/submissions/${sessionId}`);
    await page.getByRole("button", { name: "Send to several PEOs" }).click();
    const panel = page.getByRole("region", { name: "Send to several PEOs" });
    await expect(panel.getByText("Not ready to send yet")).toBeVisible();
    await expect(panel.getByText(/^Move this submission to Ready for market first\. It is /)).toBeVisible();
    await expect(panel.getByText(/Your firm hasn't been approved to send to PEOs yet\./)).toBeVisible();
  });

  await test.step("Nevermore approves the firm and the submission reaches Ready for market: nothing is said", async () => {
    await withDb(async (client) => {
      await client.query("UPDATE public.firms SET approved_at = now() WHERE id = $1", [firmId]);
      await client.query("UPDATE public.submission_workflow SET status = 'ready_for_market' WHERE session_id = $1", [sessionId]);
    });
    await page.reload();
    await page.getByRole("button", { name: "Send to several PEOs" }).click();
    const panel = page.getByRole("region", { name: "Send to several PEOs" });
    await expect(panel.getByRole("checkbox").first()).toBeVisible();
    await expect(panel.getByText("Not ready to send yet")).toHaveCount(0);
  });
});
