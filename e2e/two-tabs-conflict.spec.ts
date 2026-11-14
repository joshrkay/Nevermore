import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, firmUrl, GATEWAY_URL, PG } from "./stack/config.mjs";
import { totpCode } from "./stack/totp.mjs";
import { agreeToIntakeConsent, agreeToIntakeConsentOverRest } from "./support/consent";

const SESSION_URL = /\/start\?session=([0-9a-f-]{36})$/;
const FIRST_START = "January 2027";
const STALE_START = "March 2027";
const LATER_START = "May 2027";

interface SavedIntake {
  data_version: number;
  start_month: string | null;
}

async function readIntake(sessionId: string): Promise<SavedIntake> {
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT data_version, chamber_data ->> 'start_month' AS start_month FROM chamber_sessions WHERE id = $1",
      [sessionId],
    );
    return rows[0] as SavedIntake;
  } finally {
    await client.end();
  }
}

/** Opens the Company tab and sets Target Start, the way a prospect does. */
async function setTargetStart(page: Page, value: string, existing: boolean) {
  await page.getByRole("button", { name: "② Company", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Company Profile" })).toBeVisible();
  await page.getByRole("button", { name: `${existing ? "Edit" : "Add"} Target Start`, exact: true }).click();
  await page.getByRole("textbox", { name: "Target Start", exact: true }).fill(value);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(value, { exact: true })).toBeVisible();
}

const saved = (page: Page) => page.getByRole("status").getByText("Saved", { exact: true });

test("a tab that is behind is told so and cannot overwrite the other tab's save", async ({ context, page }) => {
  await page.goto("/start");
  await agreeToIntakeConsent(page);
  // Nothing exists until the prospect starts (A-1): an industry starts this intake.
  await page.getByRole("button", { name: "② Company", exact: true }).click();
  await page.getByRole("button", { name: "Add Industry", exact: true }).click();
  await page.getByRole("textbox", { name: "Industry", exact: true }).fill("Bookbinding");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(saved(page)).toBeVisible();
  const sessionId = SESSION_URL.exec(page.url())![1];

  // The same browser, so the same guest (who has agreed already): two tabs of one prospect.
  const stale = await context.newPage();
  await stale.goto(`/start?session=${sessionId}`);
  await expect(stale.getByRole("button", { name: "② Company", exact: true })).toBeVisible();
  const opened = await readIntake(sessionId);
  expect(opened.start_month).toBeNull();

  await test.step("the first tab saves and the version goes up once", async () => {
    await setTargetStart(page, FIRST_START, false);
    await expect(saved(page)).toBeVisible();
    expect(await readIntake(sessionId)).toEqual({ data_version: opened.data_version + 1, start_month: FIRST_START });
  });

  await test.step("the tab that is behind is refused and offers the choice", async () => {
    await setTargetStart(stale, STALE_START, false);
    await expect(stale.getByRole("alert").getByText("Not saved: this intake was changed in another tab or device.")).toBeVisible();
    await expect(stale.getByRole("button", { name: "Load latest", exact: true })).toBeVisible();
    await expect(stale.getByRole("button", { name: "Keep my changes", exact: true })).toBeVisible();
    // What it typed is still on its screen, and nothing reached the database.
    await expect(stale.getByText(STALE_START, { exact: true })).toBeVisible();
    expect(await readIntake(sessionId)).toEqual({ data_version: opened.data_version + 1, start_month: FIRST_START });
  });

  await test.step("loading the latest shows the other tab's answer, and saving works again", async () => {
    await stale.getByRole("button", { name: "Load latest", exact: true }).click();
    await expect(stale.getByRole("button", { name: "Load latest", exact: true })).toHaveCount(0);
    await expect(stale.getByText(FIRST_START, { exact: true })).toBeVisible();
    await expect(stale.getByText(STALE_START, { exact: true })).toHaveCount(0);

    await setTargetStart(stale, LATER_START, true);
    await expect.poll(() => readIntake(sessionId)).toEqual({ data_version: opened.data_version + 2, start_month: LATER_START });
    await expect(saved(stale)).toBeVisible();
    await expect(stale.getByRole("button", { name: "Keep my changes", exact: true })).toHaveCount(0);
  });
});

/** A fresh guest, and a session row of theirs, made through the gateway's REST like the app does. */
async function guestWithSession(request: APIRequestContext) {
  const signup = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: {} });
  expect(signup).toBeOK();
  const { access_token: token, user } = (await signup.json()) as { access_token: string; user: { id: string } };
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" };
  await agreeToIntakeConsentOverRest(request, headers);

  const created = await request.post(`${GATEWAY_URL}/rest/v1/chamber_sessions?select=id,data_version`, {
    headers,
    data: { user_id: user.id, chamber_data: { employee_count: 12 } },
  });
  expect(created).toBeOK();
  const [row] = (await created.json()) as { id: string; data_version: number }[];
  expect(row.data_version).toBe(1);
  const patch = (filter: string, body: unknown) =>
    request.patch(`${GATEWAY_URL}/rest/v1/chamber_sessions?id=eq.${row.id}${filter}&select=id,data_version`, { headers, data: body });
  return { id: row.id, patch };
}

test("the database refuses an invalid answer, names it, and changes nothing", async ({ request }) => {
  const { id, patch } = await guestWithSession(request);

  const refused = await patch("&data_version=eq.1", { chamber_data: { employee_count: -5 } });
  expect(refused.status()).toBe(400);
  expect(await refused.json()).toMatchObject({
    code: "EA001",
    details: "employee_count",
    message: expect.stringContaining("Invalid intake data at employee_count"),
  });

  const refusedState = await patch("&data_version=eq.1", { chamber_data: { employees: [{ first_name: "Ada", state: "ZZ" }] } });
  expect(refusedState.status()).toBe(400);
  expect(await refusedState.json()).toMatchObject({ code: "EA001", details: "employees[0].state" });

  // Neither the answers nor the version moved, so the refused saves used no version.
  expect(await readIntake(id)).toMatchObject({ data_version: 1 });
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    const { rows } = await client.query("SELECT chamber_data FROM chamber_sessions WHERE id = $1", [id]);
    expect(rows[0].chamber_data).toEqual({ employee_count: 12 });
  } finally {
    await client.end();
  }
});

test("a save from an old version updates nothing, and the version is the database's to set", async ({ request }) => {
  const { id, patch } = await guestWithSession(request);

  // The version in the body is ignored: it would otherwise let a client claim any version it likes.
  const first = await patch("&data_version=eq.1", { chamber_data: { employee_count: 13 }, data_version: 99 });
  expect(first.status()).toBe(200);
  expect(await first.json()).toEqual([{ id, data_version: 2 }]);

  const stale = await patch("&data_version=eq.1", { chamber_data: { employee_count: 14 } });
  expect(stale.status()).toBe(200);
  expect(await stale.json()).toEqual([]);

  const current = await patch("&data_version=in.(2,3)", { chamber_data: { employee_count: 15 } });
  expect(await current.json()).toEqual([{ id, data_version: 3 }]);
});

// A broker's two tabs on one referral partner (stories CRM-S2.4a, CRM-S2.4b): the tab that is behind opens the conflict dialog instead of overwriting,
// "Keep mine" saves its text over the other tab's change from the version that holds it, and with no connection a banner says so and Save says why it
// can't be used. The partner is the first record with a version; later records' forms use the same dialog.
test("a broker's second tab is told what the first changed, keeps its own words, and is told when the connection goes", async ({ browser, request }) => {
  const stamp = Date.now();
  const address = `twotabs-${stamp}`;
  const email = `twotabs-${stamp}@example.test`;
  const password = "correct-horse-battery-staple";
  const signup = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email, password } });
  expect(signup.status()).toBe(200);
  const userId = ((await signup.json()) as { user: { id: string } }).user.id;
  const withDb = async <T,>(run: (client: pg.Client) => Promise<T>): Promise<T> => {
    const client = new pg.Client({ ...PG, database: DATABASE });
    await client.connect();
    try {
      return await run(client);
    } finally {
      await client.end();
    }
  };
  await withDb(async (client) => {
    const firm = await client.query("INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Two Tabs Co', $1, now(), 'approved', now()) RETURNING id", [address]);
    await client.query("INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ($1, $2, 'owner')", [firm.rows[0].id, userId]);
  });
  const partnerNow = () => withDb(async (client) => {
    const { rows } = await client.query("SELECT name, version FROM public.referral_partners WHERE firm_id = (SELECT id FROM public.firms WHERE address = $1) AND code = 'twin'", [address]);
    return rows[0] as { name: string; version: number };
  });

  const context = await browser.newContext();
  const first = await context.newPage();
  await test.step("the broker signs in and adds a partner", async () => {
    await first.goto(`${firmUrl(address)}/advisor`);
    await first.getByLabel("Email").fill(email);
    await first.getByLabel("Password").fill(password);
    await first.getByRole("button", { name: "Sign In" }).click();
    await expect(first.getByRole("heading", { name: "Add a second step to your sign-in" })).toBeVisible();
    const secret = (await first.locator("span.font-mono").innerText()).trim();
    await first.getByLabel(/6-digit code/).fill(totpCode(secret));
    await first.getByRole("button", { name: "Turn on and continue" }).click();
    await expect(first.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await first.goto(`${firmUrl(address)}/advisor/partners`);
    await first.getByLabel("Name").fill("Twin Partners");
    await first.getByLabel("Kind of partner").selectOption({ index: 1 });
    await first.getByLabel("Code in their link").fill("twin");
    await first.getByRole("button", { name: "Add partner" }).click();
    await expect(first.getByRole("cell", { name: "Twin Partners" })).toBeVisible();
    expect(await partnerNow()).toEqual({ name: "Twin Partners", version: 1 });
  });

  // The same browser, so the same broker: two tabs.
  const second = await context.newPage();
  await second.goto(`${firmUrl(address)}/advisor/partners`);
  await second.getByRole("button", { name: "Edit Twin Partners" }).click();
  await second.getByRole("form", { name: /^Edit Twin Partners/ }).getByRole("textbox", { name: "Name" }).fill("Twin Partners Too");

  await test.step("the first tab renames the partner", async () => {
    await first.getByRole("button", { name: "Edit Twin Partners" }).click();
    await first.getByRole("form", { name: /^Edit Twin Partners/ }).getByRole("textbox", { name: "Name" }).fill("Twin Partners First");
    await first.getByRole("button", { name: "Save" }).click();
    await expect(first.getByRole("cell", { name: "Twin Partners First" })).toBeVisible();
    expect(await partnerNow()).toEqual({ name: "Twin Partners First", version: 2 });
  });

  await test.step("the second tab is refused, and the dialog shows both names and who changed it", async () => {
    await second.getByRole("button", { name: "Save" }).click();
    const dialog = second.getByRole("alertdialog", { name: "Someone else changed this partner" });
    await expect(dialog).toBeVisible();
    const name = dialog.getByRole("row", { name: /Name/ });
    await expect(name).toContainText("Twin Partners Too");
    await expect(name).toContainText("Twin Partners First");
    await expect(name).toContainText(email);
    await expect(dialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
    expect(await partnerNow()).toEqual({ name: "Twin Partners First", version: 2 });
    // Keep editing changes nothing: the typing is still there, and the dialog is gone.
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(second.getByRole("form", { name: /^Edit Twin Partners/ }).getByRole("textbox", { name: "Name" })).toHaveValue("Twin Partners Too");
    expect(await partnerNow()).toEqual({ name: "Twin Partners First", version: 2 });
  });

  await test.step("with no connection a banner says so and Save says why it can't be used", async () => {
    await context.setOffline(true);
    await expect(second.getByRole("status", { name: "Connection" })).toContainText("You're offline");
    const save = second.getByRole("button", { name: "Save" });
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(save).toHaveAccessibleDescription("You're offline. Saving is back when you are.");
    await save.click({ force: true }); // aria-disabled is not disabled: the click is made, and ignored
    await expect(second.getByRole("form", { name: /^Edit Twin Partners/ }).getByRole("textbox", { name: "Name" })).toHaveValue("Twin Partners Too");
    await context.setOffline(false);
    await expect(second.getByRole("status", { name: "Connection" })).toHaveText("");
    await expect(second.getByRole("button", { name: "Save" })).not.toHaveAttribute("aria-disabled", "true");
  });

  await test.step("Keep mine saves the second tab's words over the first's, from the version that holds them", async () => {
    await second.getByRole("button", { name: "Save" }).click();
    await second.getByRole("alertdialog").getByRole("button", { name: "Keep mine" }).click();
    await expect(second.getByRole("cell", { name: "Twin Partners Too" })).toBeVisible();
    await expect(second.getByRole("alertdialog")).toHaveCount(0);
    expect(await partnerNow()).toEqual({ name: "Twin Partners Too", version: 3 });
    await expect(second.getByRole("button", { name: "Edit Twin Partners Too" })).toBeFocused();
  });
});
