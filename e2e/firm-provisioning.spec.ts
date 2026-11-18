import { createHash } from "node:crypto";
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

// The people of a provisioned firm (CRM-P1.2, CRM-P2.1): its owner invites someone, who creates an account from the link,
// joins, and works in the firm; the owner sees their work; what only owners may open stays closed to them; and the owner of
// another provisioned firm sees none of it, on the screen or over the API with their own sign-in. The invitation is made by
// the database function the invite-member server function calls, as the owner, with the owner's own session: this stack
// does not run that function (its handler is tested with the mail provider faked), and nothing is inserted.

const TEAM_FIRM = `Tideline Brokers ${stamp}`;
const TEAM_ADDRESS = `tideline-brokers-${stamp}`;
const RIVAL_FIRM = `Quarry Benefits ${stamp}`;
const RIVAL_ADDRESS = `quarry-benefits-${stamp}`;
const OWNER = `owner-${stamp}@example.test`;
const AGENT = `agent-${stamp}@example.test`;
const RIVAL = `rival-${stamp}@example.test`;
const TOKEN = `e2e-provisioned-${stamp}-abcdefghijklmnopqrstuvwxyz`;
const ACCOUNT = `Saltmarsh Bakery ${stamp}`;

/** Signs in with a password at a firm's address and sets up the second factor, reaching the console. */
async function enterFirm(page: Page, address: string, email: string) {
  await page.goto(`${firmUrl(address)}/advisor`);
  await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await setUpSecondFactor(page);
  await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
}

/** The access token of the session this page holds at its address. */
const accessToken = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return key ? (JSON.parse(localStorage.getItem(key) ?? "{}") as { access_token?: string }).access_token : undefined;
  });

test("a provisioned firm's owner invites a person, who joins and works there; another provisioned firm sees none of it", async ({ browser, request }) => {
  test.setTimeout(180_000); // three people, each creating an account and setting up a second factor
  const owner = await browser.newContext();
  const agent = await browser.newContext();
  const rival = await browser.newContext();
  const ownerPage = await owner.newPage();
  const agentPage = await agent.newPage();
  const rivalPage = await rival.newPage();
  try {
    await test.step("two firms are provisioned by their founders, who each enter their own", async () => {
      await signUpFirmFromNothing(ownerPage, OWNER, TEAM_FIRM, TEAM_ADDRESS);
      await signUpFirmFromNothing(rivalPage, RIVAL, RIVAL_FIRM, RIVAL_ADDRESS);
      await enterFirm(ownerPage, TEAM_ADDRESS, OWNER);
      await enterFirm(rivalPage, RIVAL_ADDRESS, RIVAL);
    });

    await test.step("the owner invites a person as an agent, with their own session", async () => {
      const firm = await withDb((c) => c.query("SELECT id FROM public.firms WHERE address = $1", [TEAM_ADDRESS]));
      const res = await request.post(`${GATEWAY_URL}/rest/v1/rpc/invite_member`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${await accessToken(ownerPage)}`, "x-firm-address": TEAM_ADDRESS },
        data: { p_firm_id: firm.rows[0].id, p_email: AGENT, p_role: "agent", p_team_id: null, p_token_hash: createHash("sha256").update(TOKEN).digest("hex") },
      });
      expect(res.status(), await res.text()).toBe(200);
      // The other firm's owner cannot invite into this firm.
      const refused = await request.post(`${GATEWAY_URL}/rest/v1/rpc/invite_member`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${await accessToken(rivalPage)}`, "x-firm-address": RIVAL_ADDRESS },
        data: { p_firm_id: firm.rows[0].id, p_email: `planted-${stamp}@example.test`, p_role: "owner", p_team_id: null, p_token_hash: createHash("sha256").update(`${TOKEN}-x`).digest("hex") },
      });
      expect(refused.status()).toBeGreaterThanOrEqual(400);
    });

    await test.step("the invited person creates an account from the link and joins as an agent", async () => {
      await agentPage.goto(`${firmUrl(TEAM_ADDRESS)}/join#token=${TOKEN}`);
      await expect(agentPage.getByRole("heading", { name: `Join ${TEAM_FIRM}` })).toBeVisible();
      await agentPage.getByRole("button", { name: "Sign in or create an account" }).click();
      await agentPage.getByLabel("Email").fill(AGENT);
      await agentPage.getByLabel("Password").fill(PASSWORD);
      await agentPage.getByRole("button", { name: "Create Account" }).click();
      await agentPage.getByRole("button", { name: `Join ${TEAM_FIRM}` }).click();
      await expect(agentPage.getByRole("heading", { name: `You've joined ${TEAM_FIRM}` })).toBeVisible();
      const members = await withDb((c) =>
        c.query(
          "SELECT u.email, m.role FROM public.firm_memberships m JOIN auth.users u ON u.id = m.user_id JOIN public.firms f ON f.id = m.firm_id WHERE f.address = $1 AND m.valid_until IS NULL ORDER BY m.role",
          [TEAM_ADDRESS],
        ),
      );
      expect(members.rows).toEqual([{ email: AGENT, role: "agent" }, { email: OWNER, role: "owner" }]);
    });

    await test.step("the agent works in the firm: they add an account", async () => {
      await agentPage.getByRole("link", { name: "Continue" }).click();
      await setUpSecondFactor(agentPage);
      await expect(agentPage.getByRole("heading", { name: "Submissions" })).toBeVisible();
      await agentPage.goto(`${firmUrl(TEAM_ADDRESS)}/accounts`);
      await agentPage.getByRole("button", { name: "New account" }).first().click();
      const dialog = agentPage.getByRole("dialog");
      await dialog.getByLabel("Account name").fill(ACCOUNT);
      await dialog.getByRole("button", { name: "Save account" }).click();
      await expect(agentPage.getByRole("heading", { level: 1, name: ACCOUNT })).toBeVisible();
    });

    await test.step("what only owners may open stays closed to the agent", async () => {
      await agentPage.goto(`${firmUrl(TEAM_ADDRESS)}/firm/invitations`);
      await expect(agentPage.getByText("Only an owner of the firm can invite people.")).toBeVisible();
      // And the database refuses the agent's own attempt, whatever the page shows.
      const firm = await withDb((c) => c.query("SELECT id FROM public.firms WHERE address = $1", [TEAM_ADDRESS]));
      const refused = await request.post(`${GATEWAY_URL}/rest/v1/rpc/invite_member`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${await accessToken(agentPage)}`, "x-firm-address": TEAM_ADDRESS },
        data: { p_firm_id: firm.rows[0].id, p_email: `friend-${stamp}@example.test`, p_role: "owner", p_team_id: null, p_token_hash: createHash("sha256").update(`${TOKEN}-y`).digest("hex") },
      });
      expect(refused.status()).toBeGreaterThanOrEqual(400);
      const pending = await withDb((c) => c.query("SELECT count(*)::int AS n FROM public.firm_invitations WHERE firm_id = $1 AND email <> $2", [firm.rows[0].id, AGENT]));
      expect(pending.rows[0].n).toBe(0);
    });

    await test.step("the owner sees the agent's account", async () => {
      await ownerPage.goto(`${firmUrl(TEAM_ADDRESS)}/accounts`);
      await expect(ownerPage.getByRole("link", { name: ACCOUNT })).toBeVisible();
    });

    await test.step("the other firm's owner sees no account, on the screen or over the API with their own sign-in", async () => {
      await rivalPage.goto(`${firmUrl(RIVAL_ADDRESS)}/accounts`);
      await expect(rivalPage.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();
      await expect(rivalPage.getByRole("link", { name: ACCOUNT })).toHaveCount(0);
      const token = await accessToken(rivalPage);
      for (const address of [RIVAL_ADDRESS, TEAM_ADDRESS]) {
        const res = await request.get(`${GATEWAY_URL}/rest/v1/accounts?select=name`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "x-firm-address": address } });
        expect(res.status()).toBe(200);
        expect(await res.json()).toEqual([]);
      }
      // The same read with the agent's sign-in gives the account, so the empty answers above are the rule's doing.
      const mine = await request.get(`${GATEWAY_URL}/rest/v1/accounts?select=name`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${await accessToken(agentPage)}`, "x-firm-address": TEAM_ADDRESS },
      });
      expect(await mine.json()).toEqual([{ name: ACCOUNT }]);
    });
  } finally {
    await owner.close();
    await agent.close();
    await rival.close();
  }
});
