import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { DATABASE, PG } from "./stack/config.mjs";
import { agreeToIntakeConsent } from "./support/consent";

// The intake lifecycle in a real browser, against the real migrations: "Start over" archives the draft
// and nothing reaches it again (A-1.5); an idle draft expires and says so (A-1.5); answers whose save
// failed survive the tab closing and are offered back (A-1.4).

const SESSION_URL = /\/start\?session=([0-9a-f-]{36})$/;

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

/** Opens the Company tab and sets Target Start, the way a prospect does. */
async function setTargetStart(page: Page, value: string, existing = false) {
  await page.getByRole("button", { name: "② Company", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Company Profile" })).toBeVisible();
  await page.getByRole("button", { name: `${existing ? "Edit" : "Add"} Target Start`, exact: true }).click();
  await page.getByRole("textbox", { name: "Target Start", exact: true }).fill(value);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(value, { exact: true })).toBeVisible();
}

const saved = (page: Page) => page.getByRole("status").getByText("Saved", { exact: true });

// Each test is a new browser context, so a new guest, who is asked for consent first.
async function openNewIntake(page: Page) {
  await page.goto("/start");
  await agreeToIntakeConsent(page);
  await expect(page).toHaveURL(SESSION_URL);
  return SESSION_URL.exec(page.url())![1];
}

test("starting over archives the draft, and nothing opens it again", async ({ page }) => {
  const first = await openNewIntake(page);
  await setTargetStart(page, "January 2027");
  await expect(saved(page)).toBeVisible();

  await page.getByRole("button", { name: "Start over", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("will be archived");
  await dialog.getByRole("button", { name: "Start over", exact: true }).click();

  await expect(page).not.toHaveURL(new RegExp(first));
  await expect(page).toHaveURL(SESSION_URL);
  const second = SESSION_URL.exec(page.url())![1];
  await page.getByRole("button", { name: "② Company", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add Target Start", exact: true })).toBeVisible();

  const [archived] = await sql<{ status: string; events: number }>(
    "SELECT status, (SELECT count(*)::int FROM intake_lifecycle_events WHERE session_id = $1 AND to_status = 'archived') AS events FROM chamber_sessions WHERE id = $1",
    [first],
  );
  expect(archived).toEqual({ status: "archived", events: 1 });
  expect((await sql<{ status: string }>("SELECT status FROM chamber_sessions WHERE id = $1", [second]))[0].status).toBe("in_progress");

  // Not even its own link opens it.
  await page.goto(`/start?session=${first}`);
  await expect(page.getByRole("heading", { name: "We couldn't open that intake" })).toBeVisible();
});

test("an intake left idle past the window expires, says so, and starts fresh", async ({ page }) => {
  const sessionId = await openNewIntake(page);
  await setTargetStart(page, "February 2027");
  await expect(saved(page)).toBeVisible();

  // 31 days without a change, then the hourly job runs.
  await sql("UPDATE chamber_sessions SET last_activity_at = now() - interval '31 days' WHERE id = $1", [sessionId]);
  const [{ moved }] = await sql<{ moved: number }>("SELECT expire_idle_intakes() AS moved");
  expect(moved).toBeGreaterThanOrEqual(1);

  await test.step("the tab still open is told when it next saves, and saves nothing", async () => {
    await setTargetStart(page, "April 2027", true);
    await expect(page.getByRole("alert").getByText("Not saved: this intake has expired.")).toBeVisible();
    const [row] = await sql<{ status: string; start: string }>("SELECT status, chamber_data ->> 'start_month' AS start FROM chamber_sessions WHERE id = $1", [sessionId]);
    expect(row).toEqual({ status: "expired", start: "February 2027" });
  });

  await test.step("opening it again shows that it expired, and offers a new intake", async () => {
    // Closing would ask to keep the unsaved change; a new tab is the prospect coming back.
    const later = await page.context().newPage();
    await page.close();
    await later.goto(`/start?session=${sessionId}`);
    await expect(later.getByRole("heading", { name: "This intake has expired" })).toBeVisible();
    await expect(later.getByText(/kept for 30 days after the last change/)).toBeVisible();
    await later.getByRole("button", { name: "Start a new intake", exact: true }).click();
    // The expired intake's own link matches SESSION_URL too, so wait until the address names another intake.
    await expect(later).toHaveURL((url) => (SESSION_URL.exec(url.href)?.[1] ?? sessionId) !== sessionId);
  });
});

test("answers whose save failed survive the tab closing and are offered back", async ({ context, page }) => {
  const sessionId = await openNewIntake(page);

  // The network drops every save.
  await page.route("**/rest/v1/chamber_sessions?**", (route) => (route.request().method() === "PATCH" ? route.abort() : route.continue()));
  await setTargetStart(page, "March 2027");
  await expect(page.getByRole("status").getByText("Not saved", { exact: true })).toBeVisible();
  expect((await sql<{ start: string | null }>("SELECT chamber_data ->> 'start_month' AS start FROM chamber_sessions WHERE id = $1", [sessionId]))[0].start).toBeNull();

  // The tab goes away without a chance to save (a crash, or a closed laptop).
  const back = await context.newPage();
  await page.close();
  await back.goto(`/start?session=${sessionId}`);
  const notice = back.getByRole("alert").filter({ hasText: "didn't reach our server" });
  await expect(notice).toBeVisible();

  await notice.getByRole("button", { name: "Restore my changes", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await back.getByRole("button", { name: "② Company", exact: true }).click();
  await expect(back.getByText("March 2027", { exact: true })).toBeVisible();
  await expect.poll(async () => (await sql<{ start: string | null }>("SELECT chamber_data ->> 'start_month' AS start FROM chamber_sessions WHERE id = $1", [sessionId]))[0].start).toBe("March 2027");
  await expect(saved(back)).toBeVisible();
  // Saved, so the browser no longer needs its copy.
  await expect.poll(() => back.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("eaa.intake-backup.")).length)).toBe(0);
});
