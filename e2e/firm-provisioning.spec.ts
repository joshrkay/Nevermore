import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, APP_URL, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// A firm is provisioned from nothing, through the screens a broker and a platform admin use (story CRM-P1.1 with Q-1.2,
// "Creating a firm end to end"). Every other spec here inserts its firm and its memberships in the database; this one
// inserts neither. A person with no account opens "Sign up your firm", creates the account, names the firm, and is its
// owner; they sign in at the firm's new address and work there before any approval; a platform admin sees the firm
// waiting and approves it; the founder is still in, and a second firm provisioned the same way cannot be entered by them.
// The only database writes are the platform admin's role (the setup script's --grant-admin) and reads to check the result.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `Provisioned Brokers ${stamp}`;
const ADDRESS = `provisioned-brokers-${stamp}`;
const OTHER_FIRM = `Neighbour Benefits ${stamp}`;
const OTHER_ADDRESS = `neighbour-benefits-${stamp}`;
const FOUNDER = `founder-${stamp}@example.test`;
const OTHER_FOUNDER = `neighbour-${stamp}@example.test`;
const ADMIN = `platform-admin-${stamp}@example.test`;

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** The second factor a password sign-in is asked to set up (CRM-P1.3b), turned on with a code from the secret shown. */
async function setUpSecondFactor(page: Page) {
  await expect(page.getByRole("heading", { name: "Add a second step to your sign-in" })).toBeVisible();
  const secret = (await page.locator("span.font-mono").innerText()).trim();
  await page.getByLabel(/6-digit code/).fill(totpCode(secret));
  await page.getByRole("button", { name: "Turn on and continue" }).click();
}

/** From nothing: the sign-up page sends a visitor to create an account, brings them back, and makes the firm. */
async function signUpFirmFromNothing(page: Page, email: string, firm: string, address: string) {
  await page.goto(`${APP_URL}/firms/new`);
  await expect(page.getByRole("heading", { name: "Sign up your firm" })).toBeVisible();
  await expect(page.getByText("Create an account, then set up your firm.")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create Account" }).click();

  // Back on the firm's form, signed in as the new account.
  await expect(page.getByRole("form", { name: "Sign up your firm" })).toBeVisible();
  await expect(page.getByText(`signed in as ${email}`)).toBeVisible();
  await page.getByLabel("Firm name").fill(firm);
  // The address is suggested from the name.
  await expect(page.getByLabel("Firm address")).toHaveValue(address);
  await page.getByRole("button", { name: "Sign up your firm" }).click();
  await expect(page.getByRole("heading", { name: `${firm} is set up` })).toBeVisible();
  await expect(page.getByRole("link", { name: firmUrl(address) })).toBeVisible();
}

test("a firm is provisioned from nothing: sign-up, its own address, an admin's approval, and nobody else's records", async ({ browser }) => {
  test.setTimeout(120_000); // three people, three sign-ins and two second factors in one journey
  const founder = await browser.newContext();
  const admin = await browser.newContext();
  const page = await founder.newPage();
  try {
    await test.step("a person with no account signs their firm up and becomes its owner", async () => {
      await signUpFirmFromNothing(page, FOUNDER, FIRM, ADDRESS);
      const rows = await withDb((c) =>
        c.query(
          `SELECT f.approved_at, f.decision, m.role, u.email AS signer
             FROM public.firms f
             JOIN public.firm_memberships m ON m.firm_id = f.id AND m.valid_until IS NULL
             JOIN auth.users u ON u.id = f.signed_up_by
            WHERE f.address = $1`,
          [ADDRESS],
        ),
      );
      expect(rows.rows).toEqual([{ approved_at: null, decision: null, role: "owner", signer: FOUNDER }]);
    });

    await test.step("the firm's address exists at once, names the firm, and lets its owner in to work", async () => {
      await page.goto(`${firmUrl(ADDRESS)}/advisor`);
      await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
      await expect(page.getByText(FIRM)).toBeVisible();
      await page.getByLabel("Email").fill(FOUNDER);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign In" }).click();
      await setUpSecondFactor(page);
      await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`^${firmUrl(ADDRESS)}/advisor`));
    });

    await test.step("the platform's admins are told a firm is waiting", async () => {
      const rows = await withDb((c) =>
        c.query("SELECT o.kind, o.payload->>'address' AS address FROM public.outbox_events o JOIN public.firms f ON f.id = o.firm_id WHERE f.address = $1", [ADDRESS]),
      );
      expect(rows.rows).toEqual([{ kind: "firm_waiting", address: ADDRESS }]);
    });

    await test.step("a platform admin sees the firm waiting, with who signed it up, and approves it", async () => {
      const res = await admin.request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email: ADMIN, password: PASSWORD } });
      expect(res.status()).toBe(200);
      const { user } = (await res.json()) as { user: { id: string } };
      await withDb((c) => c.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')", [user.id]));

      const adminPage = await admin.newPage();
      await adminPage.goto(`${APP_URL}/advisor/firms`);
      await adminPage.getByLabel("Email").fill(ADMIN);
      await adminPage.getByLabel("Password").fill(PASSWORD);
      await adminPage.getByRole("button", { name: "Sign In" }).click();
      await setUpSecondFactor(adminPage);
      await expect(adminPage.getByRole("heading", { name: "Firm approvals" })).toBeVisible();
      const waiting = adminPage.getByRole("list", { name: "Firms waiting for approval" }).getByRole("listitem").filter({ hasText: FIRM });
      await expect(waiting).toContainText(`by ${FOUNDER}`);
      await waiting.getByRole("button", { name: `Approve ${FIRM}` }).click();
      await expect(adminPage.getByText(`${FIRM} is approved.`)).toBeVisible();
      await expect(adminPage.getByRole("list", { name: "Firms waiting for approval" }).getByRole("listitem").filter({ hasText: FIRM })).toHaveCount(0);
    });

    await test.step("the firm is approved, and its founder is told", async () => {
      const firm = await withDb((c) => c.query("SELECT approved_at IS NOT NULL AS approved, decision FROM public.firms WHERE address = $1", [ADDRESS]));
      expect(firm.rows).toEqual([{ approved: true, decision: "approved" }]);
      const mail = await withDb((c) =>
        c.query(
          "SELECT o.payload->>'recipient_email' AS recipient FROM public.outbox_events o JOIN public.firms f ON f.id = o.firm_id WHERE f.address = $1 AND o.kind = 'firm_decision'",
          [ADDRESS],
        ),
      );
      expect(mail.rows).toEqual([{ recipient: FOUNDER }]);
    });

    await test.step("the founder is still in at the firm's address, and can open its Members and Invitations", async () => {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
      await page.goto(`${firmUrl(ADDRESS)}/firm/invitations`);
      await expect(page.getByRole("heading", { name: "Invitations" })).toBeVisible();
    });

    await test.step("a second firm, provisioned the same way, is a separate tenant: the first founder is not let in", async () => {
      const other = await browser.newContext();
      try {
        await signUpFirmFromNothing(await other.newPage(), OTHER_FOUNDER, OTHER_FIRM, OTHER_ADDRESS);
      } finally {
        await other.close();
      }
      await page.goto(`${firmUrl(OTHER_ADDRESS)}/advisor`);
      await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
      await expect(page.getByText(OTHER_FIRM)).toBeVisible();
      await page.getByLabel("Email").fill(FOUNDER);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign In" }).click();
      await expect(page.getByRole("heading", { name: "You aren't a member of this firm" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Submissions" })).toHaveCount(0);
    });
  } finally {
    await founder.close();
    await admin.close();
  }
});
