import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, GATEWAY_URL, PG } from "./stack/config.mjs";

// Nothing in the app expires an intake yet: that is the retention job's work (plan A-1.5). These tests
// expire one the way that job will, as the database with no user JWT, and check what the prospect meets.

const SESSION_URL = /\/start\?session=([0-9a-f-]{36})$/;
const TARGET_START = "January 2027";

async function queryDatabase<Row>(sql: string, params: unknown[]): Promise<Row[]> {
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}

/** Expires an intake as the retention job will: a plain update, which also moves its version on. */
const expire = (sessionId: string) => queryDatabase("UPDATE chamber_sessions SET status = 'expired' WHERE id = $1", [sessionId]);

const sessionsOf = async (sessionId: string) =>
  (
    await queryDatabase<{ count: string }>(
      "SELECT count(*) FROM chamber_sessions WHERE user_id = (SELECT user_id FROM chamber_sessions WHERE id = $1)",
      [sessionId],
    )
  )[0].count;

async function openNewIntake(page: Page) {
  await page.goto("/start");
  await expect(page).toHaveURL(SESSION_URL);
  return SESSION_URL.exec(page.url())![1];
}

test("a link to an intake that has expired says so, opens nothing, and starts a new intake on request", async ({ page }) => {
  const expiredId = await openNewIntake(page);
  await expire(expiredId);

  await test.step("reloading the link shows that it expired, and creates nothing", async () => {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your intake has expired" })).toBeVisible();
    await expect(page.getByRole("button", { name: "① Upload", exact: true })).toHaveCount(0);
    expect(await sessionsOf(expiredId)).toBe("1");
  });

  const newId = await test.step("Start a new intake", async () => {
    await page.getByRole("button", { name: "Start a new intake", exact: true }).click();
    await expect(page.getByRole("button", { name: "② Company", exact: true })).toBeVisible();
    await expect(page).toHaveURL(SESSION_URL);
    const id = SESSION_URL.exec(page.url())![1];
    expect(id).not.toBe(expiredId);
    return id;
  });

  await test.step("coming back without a link picks up the new intake, not the expired one", async () => {
    await page.goto("/start");
    await expect(page).toHaveURL(`/start?session=${newId}`);
    expect(await sessionsOf(expiredId)).toBe("2");
  });
});

test("a prospect whose only intake expired is told so when they come back without a link", async ({ page }) => {
  const expiredId = await openNewIntake(page);
  await expire(expiredId);
  await page.goto("/start");
  await expect(page.getByRole("heading", { name: "Your intake has expired" })).toBeVisible();
  await expect(page).not.toHaveURL(SESSION_URL);
  expect(await sessionsOf(expiredId)).toBe("1");
});

test("an intake that expires while it is open says so at the next save, and keeps nothing sent after", async ({ page }) => {
  const sessionId = await openNewIntake(page);
  await expect(page.getByRole("button", { name: "② Company", exact: true })).toBeVisible();
  await expire(sessionId);

  await page.getByRole("button", { name: "② Company", exact: true }).click();
  await page.getByRole("button", { name: "Add Target Start", exact: true }).click();
  await page.getByRole("textbox", { name: "Target Start", exact: true }).fill(TARGET_START);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // Not "changed in another tab": expiring moved the version on, and the page reads the row to tell why.
  await expect(page.getByRole("alert").getByText("Not saved: this intake has expired and can no longer be changed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load latest", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start a new intake", exact: true })).toBeVisible();
  const [row] = await queryDatabase<{ status: string; start_month: string | null }>(
    "SELECT status, chamber_data ->> 'start_month' AS start_month FROM chamber_sessions WHERE id = $1",
    [sessionId],
  );
  expect(row).toEqual({ status: "expired", start_month: null });
});

/** A fresh guest and an intake of theirs, made through the gateway's REST like the app does. */
async function guestWithSession(request: APIRequestContext) {
  const signup = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: {} });
  expect(signup).toBeOK();
  const { access_token: token, user } = (await signup.json()) as { access_token: string; user: { id: string } };
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" };
  const created = await request.post(`${GATEWAY_URL}/rest/v1/chamber_sessions?select=id`, {
    headers,
    data: { user_id: user.id, chamber_data: { employee_count: 12 }, chosen_peo: "Justworks" },
  });
  expect(created).toBeOK();
  const [row] = (await created.json()) as { id: string }[];
  const patch = (body: unknown) =>
    request.patch(`${GATEWAY_URL}/rest/v1/chamber_sessions?id=eq.${row.id}&select=id,data_version`, { headers, data: body });
  return { id: row.id, patch };
}

test("the database refuses the owner's changes to an expired intake, whatever they are", async ({ request }) => {
  const { id, patch } = await guestWithSession(request);
  await expire(id);
  const [before] = await queryDatabase("SELECT * FROM chamber_sessions WHERE id = $1", [id]);

  for (const body of [{ chamber_data: { employee_count: 13 } }, { chosen_peo: "TriNet" }, { status: "in_progress" }]) {
    const refused = await patch(body);
    expect(refused.status(), JSON.stringify(body)).toBe(400);
    expect(await refused.json()).toMatchObject({ code: "EA002", message: "This intake has expired" });
  }
  expect(await queryDatabase("SELECT * FROM chamber_sessions WHERE id = $1", [id])).toEqual([before]);
});
