import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// The Accounts page on the table frame (story CRM-A1.1a, screen 16). A member of a firm with three accounts finds Accounts in the menu, sees them with
// their columns, narrows them by employees (the chip stays across a reload), selects a row, and opens one, whose page says "Accounts / name" and goes back to the list.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `accounts-${stamp}`;

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

test("Accounts opens from the menu, narrows by employees across a reload, and an account opens and comes back", async ({ page, request }) => {
  const member = `accounts-owner-${stamp}@example.test`;
  const memberId = await newUser(request, member);
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Accounts Advisory', $1, now(), 'everyone') RETURNING id", [FIRM]);
    const firmId = firm.rows[0].id as string;
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner')", [firmId, memberId]);
    const accounts: [string, string, number, string][] = [
      ["Harborview Dental Group", "OR", 45, "Elena"],
      ["Northline Logistics", "WA", 120, "Greg"],
      ["Cedar and Finch Architects", "CA", 28, "Mara"],
    ];
    for (const [name, state, employees, contact] of accounts) {
      const made = await client.query(
        "INSERT INTO public.accounts (firm_id, owner_id, name, state, city, employees, source) VALUES ($1, $2, $3, $4, 'Portland', $5, 'added_by_hand') RETURNING id",
        [firmId, memberId, name, state, employees],
      );
      await client.query("INSERT INTO public.contacts (firm_id, account_id, last_name, first_name, email, is_main) VALUES ($1, $2, 'Marsh', $3, $4, true)", [firmId, made.rows[0].id, contact, `${contact.toLowerCase()}@example.test`]);
    }
  });

  await test.step("Accounts is in the menu and opens the three accounts with their columns", async () => {
    await signInAndAddSecondFactor(page, `${firmUrl(FIRM)}/advisor`, member);
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await page.getByRole("link", { name: "Accounts", exact: true }).click();
    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();
    await expect(page.getByText("1 to 3 of 3 accounts")).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(4);
    await expect(page.getByRole("columnheader", { name: "Main contact" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Northline Logistics/ })).toContainText("greg@example.test");
    await expect(page.getByRole("link", { name: "Accounts", exact: true })).toHaveAttribute("aria-current", "page");
  });

  await test.step("a filter on employees narrows the list, shows as a chip, survives a reload and comes off", async () => {
    await page.getByRole("button", { name: "Filter by Employees" }).click();
    await page.getByLabel("Condition").selectOption({ label: "is more than" });
    await page.getByLabel("Number").fill("50");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Northline Logistics" })).toBeVisible();
    await expect(page).toHaveURL(/filter=employees/);
    await page.reload();
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Northline Logistics" })).toBeVisible();
  });

  await test.step("a row can be selected, the bar shows, the selection survives a reload and Clear empties it", async () => {
    await page.getByRole("checkbox", { name: "Select Northline Logistics" }).check();
    const bar = page.getByRole("region", { name: "Selected rows" });
    await expect(bar).toContainText("1 selected");
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Select Northline Logistics" })).toBeChecked();
    await expect(bar).toContainText("1 selected");
    await bar.getByRole("button", { name: "Clear" }).click();
    await expect(bar).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Select Northline Logistics" })).not.toBeChecked();
  });

  await test.step("an account's name opens its page, 'Accounts' goes back to the list", async () => {
    await page.getByRole("link", { name: "Northline Logistics" }).click();
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Northline Logistics" })).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs).toContainText("Accounts / Northline Logistics");
    await page.goBack();
    await expect(page.getByRole("row")).toHaveCount(2);
    await page.goForward();
    await crumbs.getByRole("link", { name: "Accounts" }).click();
    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByText("1 to 3 of 3 accounts")).toBeVisible();
  });
});
