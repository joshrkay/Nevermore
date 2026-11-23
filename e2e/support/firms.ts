import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { APP_URL, DATABASE, firmUrl, PG } from "../stack/config.mjs";
import { totpCode } from "../stack/totp.mjs";

// What the specs that make a firm the way a broker makes one share (firm-provisioning, workers-comp-search): the screens of sign-up and of a first sign-in
// at the firm's address, and a connection to the stack's database for the reads and the few writes a spec says it makes.

export const PASSWORD = "correct-horse-battery-staple";

export async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** The second factor a password sign-in is asked to set up (CRM-P1.3b), turned on with a code from the secret shown. */
export async function setUpSecondFactor(page: Page) {
  await expect(page.getByRole("heading", { name: "Add a second step to your sign-in" })).toBeVisible();
  const secret = (await page.locator("span.font-mono").innerText()).trim();
  await page.getByLabel(/6-digit code/).fill(totpCode(secret));
  await page.getByRole("button", { name: "Turn on and continue" }).click();
}

/** From nothing: the sign-up page sends a visitor to create an account, brings them back, and makes the firm. */
export async function signUpFirmFromNothing(page: Page, email: string, firm: string, address: string) {
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

/** Signs in with a password at a firm's address and sets up the second factor, reaching the console. */
export async function enterFirm(page: Page, address: string, email: string) {
  await page.goto(`${firmUrl(address)}/advisor`);
  await expect(page.getByRole("heading", { name: "Advisor Sign In" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await setUpSecondFactor(page);
  await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
}

/** The access token of the session this page holds at its address. */
export const accessToken = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    return key ? (JSON.parse(localStorage.getItem(key) ?? "{}") as { access_token?: string }).access_token : undefined;
  });
