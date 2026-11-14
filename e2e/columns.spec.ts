import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// The queue's columns (story CRM-S3.1a, D-185 to D-198), against the real database and a real browser. A member hides a column and moves another with the
// Columns menu by keyboard, the table changes at once and the choice is kept (a reload shows it: it is in the database, not the browser); the name column
// stays in view when the table scrolls sideways (the thing jsdom has no layout to prove); and "Back to default columns" puts the table's own back.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `columns-${stamp}`;
const DEFAULT = ["Company", "Contact", "States", "Employees", "Submitted", "Status", "Completeness", "Quotes", "Waiting since", "Quote expires"];

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

test("a member shows, hides and reorders the queue's columns by keyboard, the choice is kept, and the name column stays in view when the table scrolls", async ({ page, request }) => {
  const member = `columns-agent-${stamp}@example.test`;
  const memberId = await newUser(request, member);
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Columns Advisory', $1, now(), 'everyone') RETURNING id", [FIRM]);
    const firmId = firm.rows[0].id as string;
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'agent')", [firmId, memberId]);
    for (const name of ["Acme Columns Co", "Beta Columns Co"]) {
      const prospect = await newUser(request, `columns-prospect-${name.split(" ")[0].toLowerCase()}-${stamp}@example.test`);
      await client.query("INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ($1, $2, $3)", [prospect, firmId, JSON.stringify({ company_name: name })]);
    }
  });
  const headers = () => page.getByRole("columnheader");
  const scrollBox = () => page.getByRole("region", { name: /scrolls sideways/ });

  await test.step("the member signs in and the table has every column", async () => {
    // Narrow enough that ten columns do not fit and the table has to scroll sideways.
    await page.setViewportSize({ width: 900, height: 800 });
    await signInAndAddSecondFactor(page, `${firmUrl(FIRM)}/advisor`, member);
    await expect(page.getByRole("link", { name: "Acme Columns Co" })).toBeVisible();
    await expect(headers()).toHaveText(DEFAULT);
  });

  await test.step("the name column stays where it is, at the left edge, while the table scrolls sideways to its last column", async () => {
    const box = scrollBox();
    expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth + 100)).toBe(true);
    await box.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    expect(await box.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    const edge = (await box.boundingBox())!.x;
    // The header cell and the first row's name cell are still at the box's left edge, and the last column is in view beside them.
    expect(Math.abs((await page.getByRole("columnheader", { name: "Company" }).boundingBox())!.x - edge)).toBeLessThanOrEqual(2);
    expect(Math.abs((await page.getByRole("rowheader", { name: /Acme Columns Co/ }).boundingBox())!.x - edge)).toBeLessThanOrEqual(2);
    const last = (await page.getByRole("columnheader", { name: "Quote expires" }).boundingBox())!;
    expect(last.x).toBeGreaterThan(edge);
    expect(last.x + last.width).toBeLessThanOrEqual(edge + (await box.boundingBox())!.width + 2);
    // Nothing scrolled under the pinned cell shows through it: the cell is opaque.
    expect(await page.getByRole("rowheader", { name: /Acme Columns Co/ }).evaluate((el) => getComputedStyle(el).backgroundColor)).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    await box.evaluate((el) => { el.scrollLeft = 0; });
  });

  await test.step("the Columns menu hides one column and moves another, with the keyboard alone, keeping focus on the control used", async () => {
    await page.getByRole("button", { name: "Columns" }).click();
    const menu = page.getByRole("dialog", { name: "Columns" });
    await expect(menu).toBeVisible();
    const completeness = menu.getByRole("checkbox", { name: "Completeness" });
    await completeness.focus();
    await page.keyboard.press("Space");
    await expect(headers()).toHaveText(DEFAULT.filter((h) => h !== "Completeness"));
    // Its row went to the other list; focus went with it.
    await expect(menu.getByRole("list", { name: "Columns not shown" }).getByRole("checkbox", { name: "Completeness" })).toBeFocused();
    const up = menu.getByRole("button", { name: "Move Quotes up" });
    await up.focus();
    await page.keyboard.press("Enter");
    await expect(headers()).toHaveText(["Company", "Contact", "States", "Employees", "Submitted", "Quotes", "Status", "Waiting since", "Quote expires"]);
    await expect(menu.getByRole("button", { name: "Move Quotes up" })).toBeFocused();
    await expect(menu.getByRole("status")).toHaveText("Quotes is now column 6 of 9.");
    // The other way, which is the arrow that moves in the list: focus stays on it too.
    await menu.getByRole("button", { name: "Move Contact down" }).focus();
    await page.keyboard.press("Enter");
    await expect(headers()).toHaveText(["Company", "States", "Contact", "Employees", "Submitted", "Quotes", "Status", "Waiting since", "Quote expires"]);
    await expect(menu.getByRole("button", { name: "Move Contact down" })).toBeFocused();
    await menu.getByRole("button", { name: "Move Contact up" }).focus();
    await page.keyboard.press("Enter");
    await expect(headers()).toHaveText(["Company", "Contact", "States", "Employees", "Submitted", "Quotes", "Status", "Waiting since", "Quote expires"]);    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Columns" })).toBeFocused();
  });

  await test.step("the choice is kept: a reload shows it, because it is in the database and not the browser", async () => {
    await page.reload();
    await expect(page.getByRole("link", { name: "Acme Columns Co" })).toBeVisible();
    await expect(headers()).toHaveText(["Company", "Contact", "States", "Employees", "Submitted", "Quotes", "Status", "Waiting since", "Quote expires"]);
    await expect(page.getByText("Your columns couldn't be loaded")).toHaveCount(0);
  });

  await test.step("Back to default columns puts the table's own back, and that is kept too", async () => {
    await page.getByRole("button", { name: "Columns" }).click();
    await page.getByRole("button", { name: "Back to default columns" }).click();
    await expect(headers()).toHaveText(DEFAULT);
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByRole("link", { name: "Acme Columns Co" })).toBeVisible();
    await expect(headers()).toHaveText(DEFAULT);
  });
});
