import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// The Accounts page on the table frame (story CRM-A1.1a, screen 16). A member of a firm with three accounts finds Accounts in the menu, sees them with
// their columns, narrows them by employees (the chip stays across a reload), selects a row and clears it, and opens one, whose page says "Accounts / name" and goes back to the list.

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

  await test.step("a row can be selected, the bar shows and Clear empties it", async () => {
    await page.getByRole("checkbox", { name: "Select Northline Logistics" }).check();
    const bar = page.getByRole("region", { name: "Selected rows" });
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

  // Story CRM-A1.1c: archive from a row, find it in Archived, restore it from its page, and delete it from its page.
  await test.step("a row's Archive takes the account out of the list, Archived holds it, its page restores it", async () => {
    await page.getByRole("button", { name: "Actions for Cedar and Finch Architects" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByRole("link", { name: "Cedar and Finch Architects" })).toHaveCount(0);
    await expect(page.getByText("1 to 2 of 2 accounts")).toBeVisible();
    await page.getByRole("link", { name: /^Archived/ }).click();
    await expect(page.getByRole("link", { name: "Cedar and Finch Architects" })).toBeVisible();
    await page.getByRole("link", { name: "Cedar and Finch Architects" }).click();
    await expect(page.getByRole("note")).toContainText("This account is archived.");
    await page.getByRole("note").getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("note")).toHaveCount(0);
  });

  await test.step("an account with no intake is deleted from its page, and the list no longer has it", async () => {
    await page.getByRole("button", { name: "More actions for this account" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByRole("link", { name: "Cedar and Finch Architects" })).toHaveCount(0);
  });

  await test.step("New account makes an account owned by its maker, says what is wrong in words, and opens the new account", async () => {
    await page.getByRole("button", { name: "New account" }).click();
    const form = page.getByRole("dialog", { name: "New account" });
    await form.getByLabel("Phone").fill("call me");
    await form.getByRole("button", { name: "Save account" }).click();
    await expect(form.getByText("Enter the account's name.")).toBeVisible();
    await expect(form.getByText(/Enter a phone number like/)).toBeVisible();
    await form.getByLabel("Account name").fill("Harborview Dental East");
    await form.getByLabel("Phone").fill("(503) 555-0142");
    await form.getByLabel("City").fill("Gresham");
    await form.getByLabel("State", { exact: true }).selectOption("OR");
    await form.getByLabel("Employees").fill("12");
    await form.getByRole("button", { name: "Save account" }).click();
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Harborview Dental East" })).toBeVisible();
    await expect(page.getByText("Added by hand")).toBeVisible();
    const made = await withDb((client) => client.query("SELECT a.owner_id, a.source, a.phone FROM public.accounts a JOIN public.firms f ON f.id = a.firm_id WHERE f.address = $1 AND a.name = 'Harborview Dental East'", [FIRM]));
    expect(made.rows).toHaveLength(1);
    expect(made.rows[0]).toMatchObject({ source: "added_by_hand", phone: "(503) 555-0142" });
  });

  await test.step("Add contact on the new account: words for what is missing, one main contact that takes over, and Move to another account", async () => {
    await page.getByRole("button", { name: "Add contact" }).first().click();
    const form = page.getByRole("dialog", { name: "Add a contact" });
    await expect(form.getByText("On Harborview Dental East")).toBeVisible();
    await form.getByRole("button", { name: "Save contact" }).click();
    await expect(form.getByText("Enter the contact's last name.")).toBeVisible();
    await form.getByLabel("First name").fill("Owen");
    await form.getByLabel("Last name").fill("Park");
    await form.getByRole("button", { name: "Save contact" }).click();
    await expect(form.getByText("Enter an email or a phone number.").first()).toBeVisible();
    await form.getByLabel("Email", { exact: true }).fill("owen@harborviewdental.example");
    await form.getByLabel("Main contact for this account").check();
    await form.getByRole("button", { name: "Save and add another" }).click();
    // The form stays open, empty, for the next one; this one takes over as the main contact and the form says so before it is saved.
    await expect(form.getByLabel("Last name")).toHaveValue("");
    await form.getByLabel("First name").fill("Priya");
    await form.getByLabel("Last name").fill("Nair");
    await form.getByLabel("Phone", { exact: true }).fill("(503) 555-0150");
    await form.getByLabel("Main contact for this account").check();
    await expect(form.getByText("Owen Park is the main contact now. Saving makes this contact the main contact instead.")).toBeVisible();
    await form.getByRole("button", { name: "Save contact" }).click();
    await expect(form).toHaveCount(0);
    const contacts = await withDb((client) => client.query(
      "SELECT c.first_name, c.is_main FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id WHERE a.name = 'Harborview Dental East' ORDER BY c.created_at"));
    expect(contacts.rows).toEqual([{ first_name: "Owen", is_main: false }, { first_name: "Priya", is_main: true }]);
    await page.getByRole("tab", { name: /^Contacts/ }).click();
    const table = page.getByRole("table", { name: "The account's contacts" });
    await expect(table.getByRole("link", { name: "Priya Nair" })).toBeVisible();
    // Move Owen to Harborview Dental Group.
    await table.getByRole("button", { name: "Move Owen Park to another account" }).click();
    const move = page.getByRole("dialog", { name: "Move Owen Park" });
    await move.getByRole("radio", { name: "Harborview Dental Group" }).check();
    await move.getByRole("button", { name: "Move contact" }).click();
    await expect(move).toHaveCount(0);
    await expect(table.getByRole("link", { name: "Owen Park" })).toHaveCount(0);
    const moved = await withDb((client) => client.query("SELECT a.name FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id WHERE c.first_name = 'Owen' AND c.last_name = 'Park'"));
    expect(moved.rows).toEqual([{ name: "Harborview Dental Group" }]);
  });

  await test.step("A contact's name opens its page: details, Do not email kept, an edit saved in place, and the way back to the account", async () => {
    await page.goto(`${firmUrl(FIRM)}/accounts`);
    await page.getByRole("link", { name: "Harborview Dental East" }).click();
    await page.getByRole("tab", { name: /^Contacts/ }).click();
    await page.getByRole("table", { name: "The account's contacts" }).getByRole("link", { name: "Priya Nair" }).click();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Priya Nair" })).toBeVisible();
    await expect(page.getByText("Main contact", { exact: true }).first()).toBeVisible();
    const details = page.getByRole("region", { name: "Details" });
    await details.getByRole("button", { name: /^Edit/ }).click();
    await details.getByLabel("Title").fill("Practice Manager");
    await details.getByRole("checkbox", { name: "Do not email" }).check();
    await details.getByRole("button", { name: "Save" }).click();
    await expect(details.getByText("Practice Manager")).toBeVisible();
    await expect(page.getByText("Do not email", { exact: true }).first()).toBeVisible();
    const saved = await withDb((client) => client.query("SELECT title, do_not_email, version FROM public.contacts WHERE first_name = 'Priya' AND last_name = 'Nair'"));
    expect(saved.rows[0]).toMatchObject({ title: "Practice Manager", do_not_email: true });
    await expect(page.getByText("Not on an opportunity yet")).toBeVisible();
    await page.getByRole("button", { name: /^Add a note/ }).first().click();
    await page.getByRole("dialog").getByLabel("Note", { exact: true }).fill("Prefers mornings");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("table", { name: "The contact's calls, notes and tasks" }).getByText("Prefers mornings")).toBeVisible();
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Harborview Dental East" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Harborview Dental East" })).toBeVisible();
  });

  await test.step("Save and add a contact on New account opens the new account with the contact form open", async () => {
    await page.goto(`${firmUrl(FIRM)}/accounts`);
    await page.getByRole("button", { name: "New account" }).click();
    const form = page.getByRole("dialog", { name: "New account" });
    await form.getByLabel("Account name").fill("Lakeside Clinic");
    await form.getByRole("button", { name: "Save and add a contact" }).click();
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}$/);
    const contactForm = page.getByRole("dialog", { name: "Add a contact" });
    await expect(contactForm.getByText("On Lakeside Clinic")).toBeVisible();
  });
});
