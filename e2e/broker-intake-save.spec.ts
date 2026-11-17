import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { INTAKE_MESSAGE } from "./stack/intake-script.mjs";
import { totpCode } from "./stack/totp.mjs";

// What a broker enters in an intake the firm started is kept (D-1906), and the intake can be come back to (D-1908). The firm's member opens the intake from New quote, types an answer on a tab and tells Lenore about
// the company; each is saved, shown as Saved, and is still there after a reload, and the database holds what was entered and nothing the broker did not enter. Before D-1906 every
// one of these saves was refused by the database ("The FEIN is typed by the employer", "Only the firm's members enter answers as the broker"): the answers were drawn on
// screen, "Not saved · Retry" came up, Retry was refused the same way and a reload lost them. The existing specs create their records with SQL, so nothing had saved as a broker through the browser.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `broker-save-${stamp}`;
const COMPANY = "Ravenwood Bindery LLC"; // the company INTAKE_MESSAGE talks about, so what the fake AI extracts agrees with what the firm entered

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

/** What the database holds of the intake the firm started: the answers kept, the ones marked as a broker's, and whether an empty one slipped in. */
const heldNow = () =>
  withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT (SELECT count(*) FROM jsonb_object_keys(s.chamber_data))::int AS answers,
              (SELECT count(*) FROM jsonb_object_keys(s.field_provenance))::int AS marked,
              (s.chamber_data ? 'fein') AS has_fein,
              jsonb_array_length(s.transcript)::int AS messages
         FROM public.chamber_sessions s JOIN public.firms f ON f.id = s.firm_id
        WHERE f.address = $1 AND s.started_by IS NOT NULL`,
      [FIRM],
    );
    return rows as { answers: number; marked: number; has_fein: boolean; messages: number }[];
  });

test("what a broker types and tells Lenore in an intake the firm started is saved, shown as saved, and still there after a reload", async ({ page, request }) => {
  const member = `broker-save-${stamp}@example.test`;
  const memberId = await newUser(request, member);
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Broker Save Advisory', $1, now(), 'everyone') RETURNING id", [FIRM]);
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner')", [firm.rows[0].id, memberId]);
  });

  const dialog = page.getByRole("dialog");
  const answersLine = dialog.getByText(/answers in/).first();

  await test.step("the member signs in and starts a quote for a business, then its intake from the opportunity's Start the quote", async () => {
    await signInAndAddSecondFactor(page, `${firmUrl(FIRM)}/advisor`, member);
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await page.goto(`${firmUrl(FIRM)}/new-quote`);
    await dialog.getByLabel("Business name").fill(COMPANY);
    await dialog.getByRole("button", { name: "New account" }).click();
    await dialog.getByLabel("State").selectOption("NY");
    await dialog.getByLabel("Employees").fill("12");
    await dialog.getByLabel("Contact name").fill("Edgar Poe");
    await dialog.getByLabel("Contact email").fill("edgar@ravenwood.example");
    await dialog.getByRole("button", { name: "Save and close" }).click();
    await page.getByRole("region", { name: /^Intake/ }).getByRole("link", { name: "Start the quote" }).click();
    await dialog.getByRole("button", { name: "Start the intake" }).click();
    await expect(answersLine).toContainText("3 answers in");
  });

  await test.step("an answer typed on the Company tab is saved: Saved, never Not saved, and it is there after a reload", async () => {
    await dialog.getByRole("button", { name: "② Company", exact: true }).click();
    await dialog.getByRole("button", { name: "Add Industry", exact: true }).click();
    await dialog.getByRole("textbox", { name: "Industry", exact: true }).fill("Bookbinding");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog.getByText("Saved", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Not saved/)).toHaveCount(0);
    await expect(answersLine).toContainText("4 answers in");
    await page.reload();
    await expect(answersLine).toContainText("4 answers in");
    await dialog.getByRole("button", { name: "② Company", exact: true }).click();
    await expect(dialog.getByText("Bookbinding", { exact: true })).toBeVisible();
  });

  await test.step("closing the dialog does not lose the way back: the opportunity offers Continue the intake, which reopens the intake as it was, with the invitation", async () => {
    await dialog.getByRole("button", { name: "Save and close" }).last().click();
    const panel = page.getByRole("region", { name: /^Intake/ });
    await expect(panel.getByRole("link", { name: "Continue the intake" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Start the quote" })).toHaveCount(0);
    await panel.getByRole("link", { name: "Continue the intake" }).click();
    await expect(answersLine).toContainText("4 answers in");
    await expect(dialog.getByRole("button", { name: /^Invite/ }).first()).toBeVisible();
  });

  await test.step("what is told to Lenore is saved too, with the conversation, and is there after a reload", async () => {
    await dialog.getByRole("button", { name: "Type instead" }).click();
    const chat = dialog.getByPlaceholder("Type a message...");
    await chat.fill(INTAKE_MESSAGE);
    await chat.press("Enter");
    await expect(answersLine).toContainText("6 answers in");
    await expect(dialog.getByText("Saved", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Not saved/)).toHaveCount(0);
    await page.reload();
    await expect(answersLine).toContainText("6 answers in");
    await expect(dialog.getByText(/RESTORED FROM YOUR LAST VISIT/i)).toBeVisible();
  });

  await test.step("the database holds the six answers given, each marked as the broker's, no empty answer, no FEIN, and the conversation", async () => {
    const held = await heldNow();
    expect(held).toHaveLength(1);
    expect(held[0].answers).toBe(6);
    expect(held[0].marked).toBe(6);
    expect(held[0].has_fein).toBe(false);
    expect(held[0].messages).toBeGreaterThanOrEqual(3);
  });
});
