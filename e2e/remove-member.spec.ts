import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// An owner removes a member of the firm (story CRM-P1.5, D-18, D-27). The member is signed in at the firm's address, in a browser of
// their own; once the owner has removed them on the Members page, opening the console there says they aren't a member of this firm,
// and the membership is ended, not deleted. The password sign-in is the one this gateway stands in for, so the second factor
// (CRM-P1.3b) is set up on the way, as in the other firm flows.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const ADDRESS = `removal-${stamp}`;

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

test("an owner removes a member, who then can't open the console at the firm's address", async ({ page, browser, request }) => {
  const ownerEmail = `removal-owner-${stamp}@example.test`;
  const memberEmail = `removal-agent-${stamp}@example.test`;
  const ownerId = await newUser(request, ownerEmail);
  const memberId = await newUser(request, memberEmail);
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at) VALUES ('Removal Brokers', $1, now()) RETURNING id", [ADDRESS]);
    const firmId = firm.rows[0].id as string;
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'agent')", [firmId, ownerId, memberId]);

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await test.step("the member signs in at the firm's address and reaches the console", async () => {
      await signInAndAddSecondFactor(memberPage, `${firmUrl(ADDRESS)}/advisor`, memberEmail);
      await expect(memberPage.getByRole("heading", { name: "Submissions" })).toBeVisible();
    });

    await test.step("the owner opens Members from the menu and sees both people", async () => {
      await signInAndAddSecondFactor(page, `${firmUrl(ADDRESS)}/advisor`, ownerEmail);
      await page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Members" }).click();
      await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
      await expect(page.getByRole("row", { name: new RegExp(memberEmail) })).toContainText("Agent");
      await expect(page.getByRole("row", { name: new RegExp(ownerEmail) })).toContainText("You");
    });

    await test.step("the owner is asked to confirm, in plain words, and removes the member", async () => {
      await page.getByRole("button", { name: `Remove ${memberEmail}` }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText(`Remove ${memberEmail} from Removal Brokers?`);
      await expect(dialog).toContainText("What they created stays with the firm.");
      await dialog.getByRole("button", { name: `Remove ${memberEmail}` }).click();
      await expect(page.getByText(`${memberEmail} was removed from Removal Brokers.`)).toBeVisible();
      await expect(page.getByRole("row", { name: new RegExp(memberEmail) })).toHaveCount(0);
    });

    await test.step("the membership is ended and kept, not deleted", async () => {
      const m = await client.query("SELECT valid_until FROM public.firm_memberships WHERE firm_id = $1 AND user_id = $2", [firmId, memberId]);
      expect(m.rows).toHaveLength(1);
      expect(m.rows[0].valid_until).not.toBeNull();
    });

    await test.step("the removed member's open session, at the firm's address, lands on 'You aren't a member of this firm'", async () => {
      await memberPage.goto(`${firmUrl(ADDRESS)}/advisor`);
      await expect(memberPage.getByRole("heading", { name: "You aren't a member of this firm" })).toBeVisible();
      await expect(memberPage.getByRole("heading", { name: "Submissions" })).toHaveCount(0);
    });

    await test.step("the owner's record says who removed whom", async () => {
      await page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Activity" }).click();
      const entry = page.getByRole("row", { name: /Removed a member/ });
      await expect(entry).toContainText(ownerEmail);
      await expect(entry).toContainText(memberEmail);
    });

    await memberContext.close();
  } finally {
    await client.end();
  }
});
