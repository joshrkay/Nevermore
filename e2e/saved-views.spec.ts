import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";

// The queue's saved views (story CRM-S3.4a, D-215 on), against the real database and a real browser. An owner saves what is on screen as a view, by keyboard,
// and it is the open tab with its count; it is kept in the database (a reload shows it), renamed, shared with the firm, and an agent in another browser sees
// the shared view and can open it but not change it; the owner stops sharing it and it goes from the agent's tabs; then deletes it. Today's status tabs are
// views in code: nothing offers to change or delete them.

const PASSWORD = "correct-horse-battery-staple";
const stamp = Date.now();
const FIRM = `views-${stamp}`;

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

test("an owner saves, renames, shares and deletes a view by keyboard, an agent sees the shared one and can't change it, and a status tab can't be deleted", async ({ browser, page, request }) => {
  const owner = `views-owner-${stamp}@example.test`;
  const agent = `views-agent-${stamp}@example.test`;
  const ownerId = await newUser(request, owner);
  const agentId = await newUser(request, agent);
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Views Advisory', $1, now(), 'everyone') RETURNING id", [FIRM]);
    const firmId = firm.rows[0].id as string;
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'agent')", [firmId, ownerId, agentId]);
    for (const name of ["Acme Views Co", "Beta Views Co"]) {
      const prospect = await newUser(request, `views-prospect-${name.split(" ")[0].toLowerCase()}-${stamp}@example.test`);
      await client.query("INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ($1, $2, $3)", [prospect, firmId, JSON.stringify({ company_name: name })]);
    }
  });
  const tabs = (p: Page) => p.getByRole("navigation", { name: "Views" });
  const bar = (p: Page) => p.getByRole("group", { name: "This view" });
  const queue = `${firmUrl(FIRM)}/advisor`;

  await test.step("the owner opens the queue narrowed to one company, in the address, and saves it as a view with the keyboard", async () => {
    await signInAndAddSecondFactor(page, `${queue}?filter=company_name:contains:Acme&sort=company_name`, owner);
    await expect(page.getByRole("link", { name: "Acme Views Co" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Beta Views Co" })).toHaveCount(0);
    const save = page.getByRole("button", { name: "Save this as a view" });
    await save.focus();
    await page.keyboard.press("Enter");
    const form = page.getByRole("dialog", { name: "Save this as a view" });
    await expect(form).toBeVisible();
    await expect(form.getByRole("textbox", { name: "View name" })).toBeFocused();
    await page.keyboard.type("Acme only");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\?view=[0-9a-f-]{36}$/);
    const tab = tabs(page).getByRole("link", { name: /^Acme only/ });
    await expect(tab).toHaveAttribute("aria-current", "page");
    await expect(tab).toBeFocused();
    await expect(page.getByText("Saved the view “Acme only”. It is open now.")).toBeAttached();
    // The view holds the filter and the order, so no chip is left over it, and the rows are the same.
    await expect(page.getByRole("list", { name: "Filters in force" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Acme Views Co" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Beta Views Co" })).toHaveCount(0);
    await expect(tab).toContainText("1");
  });

  await test.step("the view is kept in the database: a reload shows it, open, with its filter and order", async () => {
    await page.reload();
    await expect(tabs(page).getByRole("link", { name: /^Acme only/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Acme Views Co" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Beta Views Co" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "ascending");
    await expect(bar(page).getByText("Only you can see this view.")).toBeVisible();
  });

  await test.step("the owner renames it, then shares it with the firm after being asked", async () => {
    await bar(page).getByRole("button", { name: "Rename" }).click();
    const rename = page.getByRole("dialog", { name: "Rename this view" });
    await expect(rename.getByRole("textbox", { name: "View name" })).toHaveValue("Acme only");
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Acme accounts");
    await page.keyboard.press("Enter");
    await expect(tabs(page).getByRole("link", { name: /^Acme accounts/ })).toBeVisible();
    await expect(bar(page).getByRole("button", { name: "Rename" })).toBeFocused();
    await bar(page).getByRole("button", { name: "Share with the firm" }).click();
    const question = page.getByRole("alertdialog", { name: "Share “Acme accounts” with the firm?" });
    await expect(question.getByRole("button", { name: "Cancel" })).toBeFocused();
    await question.getByRole("button", { name: "Share with the firm" }).click();
    await expect(tabs(page).getByRole("link", { name: /Acme accounts \(shared with the firm\)/ })).toBeVisible();
    await expect(bar(page).getByText("Shared with the firm.")).toBeVisible();
    await expect(bar(page).getByRole("button", { name: "Stop sharing" })).toBeFocused();
  });

  const agentContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  await test.step("an agent in another browser sees the shared view, opens it, and is offered no way to change it", async () => {
    await signInAndAddSecondFactor(agentPage, queue, agent);
    const tab = tabs(agentPage).getByRole("link", { name: /^Acme accounts/ });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(agentPage.getByRole("link", { name: "Acme Views Co" })).toBeVisible();
    await expect(agentPage.getByRole("link", { name: "Beta Views Co" })).toHaveCount(0);
    await expect(bar(agentPage).getByText("Shared with the firm.")).toBeVisible();
    for (const name of ["Rename", "Delete", "Share with the firm", "Stop sharing"]) await expect(bar(agentPage).getByRole("button", { name })).toHaveCount(0);
    // Their own filter over it makes it a changed view they can't save over; what they can do is keep it as their own.
    await agentPage.goto(`${queue}?view=${new URL(agentPage.url()).searchParams.get("view")}&filter=company_name:contains:Beta`);
    await expect(bar(agentPage).getByText("This view has changes you haven't saved. “Save this as a view” keeps them as a view of your own.")).toBeVisible();
    await expect(bar(agentPage).getByRole("button", { name: "Save changes to this view" })).toHaveCount(0);
  });

  await test.step("a status tab is a view in code: nothing offers to rename, share or delete it", async () => {
    await page.goto(`${queue}?view=won`);
    await expect(tabs(page).getByRole("link", { name: /^Won/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("group", { name: "This view" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  });

  await test.step("the owner stops sharing it and it goes from the agent's tabs", async () => {
    await tabs(page).getByRole("link", { name: /^Acme accounts/ }).click();
    await bar(page).getByRole("button", { name: "Stop sharing" }).click();
    await page.getByRole("alertdialog", { name: "Stop sharing “Acme accounts”?" }).getByRole("button", { name: "Stop sharing" }).click();
    await expect(bar(page).getByText("Only you can see this view.")).toBeVisible();
    await agentPage.goto(queue);
    await expect(tabs(agentPage).getByRole("link", { name: /^Won/ })).toBeVisible();
    await expect(tabs(agentPage).getByRole("link", { name: /Acme accounts/ })).toHaveCount(0);
  });

  await test.step("the owner deletes it after being asked, and the submissions stay", async () => {
    await bar(page).getByRole("button", { name: "Delete" }).click();
    const question = page.getByRole("alertdialog", { name: "Delete the view “Acme accounts”?" });
    await expect(question.getByText("The submissions stay.")).toBeVisible();
    await question.getByRole("button", { name: "Delete view" }).click();
    await expect(page).toHaveURL(`${queue}`);
    await expect(tabs(page).getByRole("link", { name: /Acme accounts/ })).toHaveCount(0);
    await expect(tabs(page).getByRole("link", { name: /^All statuses/ })).toBeFocused();
    await expect(page.getByRole("link", { name: "Acme Views Co" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Beta Views Co" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: "Acme Views Co" })).toBeVisible();
    await expect(tabs(page).getByRole("link", { name: /Acme accounts/ })).toHaveCount(0);
  });

  await agentContext.close();
});
