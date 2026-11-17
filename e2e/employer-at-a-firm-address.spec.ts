import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { consentStatements } from "../src/data/certification";
import { hashInvitationToken } from "../supabase/functions/_shared/invitationToken";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { COMPANY_NAME, INTAKE_MESSAGE } from "./stack/intake-script.mjs";

// An employer at a firm's own address (D-1907). An employer is never a member of the firm whose address they work at, and the gate that keeps strangers out of a firm's console
// stopped them too: a self-serve employer at the firm's "Get a quote" link was stopped at the email check, the step before signing, and an invited client was stopped at the page that
// accepts the invitation. Both said "You aren't a member of this firm" and offered only Sign out. The existing specs do the same journey on the main address, or create their records with SQL,
// so no test came here.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const PEO = "Justworks";

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

const notAMember = (page: Page) => page.getByRole("heading", { name: "You aren't a member of this firm" });

test("an employer who starts at a firm's own link can verify their email, sign, and get their packet there", async ({ page, request }) => {
  const address = `selfserve-${stamp}`;
  const email = `selfserve-${stamp}@example.test`;
  await withDb((client) => client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Self Serve Advisory', $1, now(), 'everyone')", [address]));

  await test.step("the firm's page offers Get a quote, and the agreement says whose firm it is", async () => {
    await page.goto(`${firmUrl(address)}/`);
    await page.getByRole("link", { name: /Get a quote|Start chatting/i }).first().click();
    await expect(page).toHaveURL(/\/start$/);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Agree and start", exact: true }).click();
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
  });

  await test.step("they tell Lenore about the company, check it, and choose a PEO", async () => {
    await page.getByPlaceholder("Type a message...").fill(INTAKE_MESSAGE);
    await page.getByPlaceholder("Type a message...").press("Enter");
    await expect(page.getByText(/twelve souls in New York/).first()).toBeVisible();
    await page.getByRole("button", { name: "⑧ Review", exact: true }).click();
    await expect(page.getByText(COMPANY_NAME, { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "See Your PEO Matches →", exact: true }).click();
    await page.getByRole("button", { name: `Choose ${PEO}`, exact: true }).click();
    await page.getByRole("button", { name: `Proceed with ${PEO} →`, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Certify & sign", exact: true })).toBeVisible();
    for (const statement of consentStatements(PEO)) await page.getByText(statement, { exact: true }).click();
  });

  await test.step("verifying their email, which makes them a signed-in person who is not a member, does not stop them", async () => {
    await expect(page.getByRole("heading", { name: "Verify your email to certify" })).toBeVisible();
    await page.getByLabel("Work email").fill(email);
    await page.getByRole("button", { name: "Send code", exact: true }).click();
    await expect(page.getByText(`We sent a code to ${email}.`)).toBeVisible();
    const otp = await request.get(`${GATEWAY_URL}/__e2e/otp`, { params: { email } });
    expect(otp.status()).toBe(200);
    await page.getByLabel("6-digit code").fill(((await otp.json()) as { code: string }).code);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Verify your email to certify" })).toHaveCount(0);
    await expect(notAMember(page)).toHaveCount(0);
    // The page was not taken down while they were checked: they are on the tab they were on, with the statements they ticked still ticked.
    await expect(page.getByRole("heading", { name: "Certify & sign", exact: true })).toBeVisible();
    for (const statement of consentStatements(PEO)) await expect(page.getByRole("checkbox", { name: statement, exact: true })).toBeChecked();
  });

  await test.step("they sign and get their packet, on the firm's address", async () => {
    await page.getByRole("textbox", { name: "Full name", exact: true }).fill("Edgar Poe");
    await page.getByRole("textbox", { name: "Role", exact: true }).fill("Owner");
    await page.getByRole("button", { name: "Click to sign digitally", exact: true }).click();
    await page.getByRole("button", { name: "Generate your packet →", exact: true }).click();
    await expect(page.getByRole("heading", { name: "You're all set." })).toBeVisible();
    expect(page.url().startsWith(firmUrl(address))).toBe(true);
    await expect(notAMember(page)).toHaveCount(0);
  });

  await test.step("the intake is the firm's, and signed", async () => {
    const rows = await withDb(async (client) => {
      const { rows } = await client.query(
        `SELECT s.status, f.address, (SELECT count(*) FROM public.chamber_certifications c WHERE c.session_id = s.id)::int AS signed
           FROM public.chamber_sessions s JOIN public.firms f ON f.id = s.firm_id WHERE f.address = $1`,
        [address],
      );
      return rows as { status: string; address: string; signed: number }[];
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].signed).toBe(1);
  });
});

test("a client invited by a firm opens the invitation at the firm's address, signs in, accepts, and reaches the intake the firm started", async ({ page, request }) => {
  const address = `invited-${stamp}`;
  const brokerEmail = `broker-${stamp}@example.test`;
  const clientEmail = `client-${stamp}@example.test`;
  const token = `e2e-invitation-token-${stamp}`;

  await test.step("a firm member has started an intake on an opportunity and invited the client (the email itself is not in this stand-in, so the database function that records it is called as the member)", async () => {
    const signup = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email: brokerEmail, password: PASSWORD } });
    expect(signup.status()).toBe(200);
    const brokerId = ((await signup.json()) as { user: { id: string } }).user.id;
    await withDb(async (client) => {
      const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Invited Advisory', $1, now(), 'everyone') RETURNING id", [address]);
      const firmId = firm.rows[0].id as string;
      await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner')", [firmId, brokerId]);
      const account = await client.query("INSERT INTO public.accounts (firm_id, owner_id, name, state, employees, source) VALUES ($1, $2, 'Quillfeather Press', 'NY', 12, 'added_by_hand') RETURNING id", [firmId, brokerId]);
      const contact = await client.query("INSERT INTO public.contacts (firm_id, account_id, last_name, first_name, email, is_main) VALUES ($1, $2, 'Quill', 'Ada', $3, true) RETURNING id", [firmId, account.rows[0].id, clientEmail]);
      const opportunity = await client.query("INSERT INTO public.opportunities (firm_id, account_id, name, main_contact_id) VALUES ($1, $2, 'PEO search', $3) RETURNING id", [firmId, account.rows[0].id, contact.rows[0].id]);
      // The request as the member makes it: the role, the claims of a second-factor sign-in and the firm's address, all for this transaction only.
      await client.query("BEGIN");
      await client.query(
        `SELECT set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true), set_config('request.method', 'POST', true), set_config('request.headers', $2, true), set_config('search_path', 'public, extensions', true)`,
        [
          JSON.stringify({ sub: brokerId, role: "authenticated", email: brokerEmail, is_anonymous: false, aal: "aal2", amr: [{ method: "password", timestamp: 1 }, { method: "totp", timestamp: 2 }] }),
          JSON.stringify({ "x-firm-address": address }),
        ],
      );
      const started = await client.query("SELECT public.start_broker_intake($1) AS r", [opportunity.rows[0].id]);
      const intakeId = (started.rows[0].r as { intake_id: string }).intake_id;
      await client.query("SELECT * FROM public.invite_intake_client($1, $2, 'Ada Quill', $3)", [intakeId, clientEmail, await hashInvitationToken(token)]);
      await client.query("COMMIT");
    });
  });

  await test.step("the invitation page names the firm and who invited them", async () => {
    await page.goto(`${firmUrl(address)}/intake-invite#token=${token}`);
    await expect(page.getByRole("heading", { name: "You were invited by Invited Advisory" })).toBeVisible();
    await expect(page.getByText(`${brokerEmail} of Invited Advisory started this PEO intake for Ada Quill`)).toBeVisible();
  });

  await test.step("they create their account with the address the invitation went to, and the invitation is still there to accept", async () => {
    await page.getByRole("button", { name: "Sign in or create an account" }).click();
    // The sign-in screen opens in its sign-up form for someone sent here to open an invitation.
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
    await page.getByLabel("Email").fill(clientEmail);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(notAMember(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open your intake/ })).toBeVisible();
  });

  await test.step("they accept, agree, and are in the intake the firm started, with what the firm entered marked as the firm's", async () => {
    await page.getByRole("button", { name: /Open your intake/ }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Agree and start", exact: true }).click();
    await expect(notAMember(page)).toHaveCount(0);
    await expect(page.getByText(/You were invited by .* of Invited Advisory\./)).toBeVisible();
    await page.getByRole("button", { name: "② Company", exact: true }).click();
    await expect(page.getByText("Quillfeather Press", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Your broker entered this").first()).toBeVisible();
    expect(page.url().startsWith(firmUrl(address))).toBe(true);
  });
});
