import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";

// An invited person opens the link at the firm's address, signs in with the invited email and becomes a member
// (story CRM-P1.2). The invitation is made in the database here: sending its email is the invite-member server function,
// which this stack does not run (its handler is tested with the mail provider faked). The link then works once.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const ADDRESS = `invited-${stamp}`;
const TOKEN = `e2e-token-${stamp}-abcdefghijklmnopqrstuvwxyz`;

test("an invited person signs in with the invited email, joins the firm, and the link then opens nothing", async ({ page, request }) => {
  const email = `invitee-${stamp}@example.test`;
  const res = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email, password: PASSWORD } });
  expect(res.status()).toBe(200);
  const { user } = (await res.json()) as { user: { id: string } };
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at) VALUES ('Invited Brokers', $1, now()) RETURNING id", [ADDRESS]);
    await client.query(
      "INSERT INTO public.firm_invitations (firm_id, email, role, token_hash, expires_at) VALUES ($1, $2, 'lead', $3, now() + interval '7 days')",
      [firm.rows[0].id, email, createHash("sha256").update(TOKEN).digest("hex")],
    );

    await test.step("the link names the firm and asks the visitor to sign in", async () => {
      await page.goto(`${firmUrl(ADDRESS)}/join#token=${TOKEN}`);
      await expect(page.getByRole("heading", { name: "Join Invited Brokers" })).toBeVisible();
      // The secret is after the #: the page takes it out of the address bar at once.
      await expect(page).toHaveURL(`${firmUrl(ADDRESS)}/join`);
      await page.getByRole("button", { name: "Sign in or create an account" }).click();
    });

    await test.step("after signing in with the invited email they come back to the link, and join", async () => {
      // The sign-in page opens on creating an account for someone sent here with none; this person has one.
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      await expect(page.getByRole("button", { name: "Join Invited Brokers" })).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();
      await page.getByRole("button", { name: "Join Invited Brokers" }).click();
      await expect(page.getByRole("heading", { name: "You've joined Invited Brokers" })).toBeVisible();
      await expect(page.getByText("You're now a lead of Invited Brokers.")).toBeVisible();
    });

    await test.step("leaving the join page does not tell the new member they are not a member", async () => {
      await page.getByRole("link", { name: "Continue" }).click();
      await expect(page).toHaveURL(/\/advisor/);
      await expect(page.getByRole("heading", { name: "You aren't a member of this firm" })).toHaveCount(0);
    });

    await test.step("they are a current lead of the firm, dated from now", async () => {
      const m = await client.query("SELECT role, valid_until FROM public.firm_memberships WHERE user_id = $1 AND firm_id = $2", [user.id, firm.rows[0].id]);
      expect(m.rows).toEqual([{ role: "lead", valid_until: null }]);
    });

    await test.step("the same link, opened again, says it was used", async () => {
      await page.goto(`${firmUrl(ADDRESS)}/join#token=${TOKEN}`);
      await page.getByRole("button", { name: "Join Invited Brokers" }).click();
      await expect(page.getByRole("alert")).toContainText("This invitation has already been used.");
    });
  } finally {
    await client.end();
  }
});
