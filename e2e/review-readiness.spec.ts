import { expect, test, type APIRequestContext } from "@playwright/test";
import pg from "pg";
import { ANON_KEY, DATABASE, GATEWAY_URL, PG } from "./stack/config.mjs";
import { agreeToIntakeConsent, agreeToIntakeConsentOverRest } from "./support/consent";

// US-1.2: the answers certification requires are marked, block The Manuscript until they're given, and are
// added in the Review step without starting over. The database refuses an unready certification as well.

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

test("missing required answers block The Manuscript, are marked in Review, and are added there", async ({ page }) => {
  await page.goto("/start");
  await agreeToIntakeConsent(page);
  // Nothing is created until the prospect adds something (A-1).
  await expect(page.getByRole("button", { name: "⑨ The Reckoning", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/start$/);

  await test.step("The Reckoning says what's missing and sends the prospect to Review", async () => {
    await page.getByRole("button", { name: "⑨ The Reckoning", exact: true }).click();
    const needed = page.getByRole("alert", { name: "Answers still needed" });
    await expect(needed).toContainText("Company legal name");
    await expect(needed).toContainText("States of operation");
    await expect(needed).toContainText("Pay frequency");
    await expect(needed).not.toContainText("Employee census");
    await needed.getByRole("button", { name: "Go to Review", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
  });

  await test.step("Review marks them and lists them as still needed", async () => {
    await expect(page.getByRole("region", { name: "Still needed" })).toContainText("Still needed before The Manuscript can be generated: 3");
    for (const name of ["Company", "Workforce", "Locations", "Payroll", "Benefits"]) {
      await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("region", { name: "Company", exact: true }).getByText("Company legal nameRequired")).toBeVisible();
    await expect(page.getByRole("region", { name: "Payroll", exact: true }).getByText("Pay frequencyRequired")).toBeVisible();
  });

  await test.step("each is added in place, and the list clears", async () => {
    for (const [label, value] of [
      ["Company legal name", "Quill & Ink Bindery"],
      ["States of operation", "NY, NJ"],
      ["Pay frequency", "Weekly"],
    ]) {
      await page.getByRole("button", { name: `Add ${label}`, exact: true }).click();
      await page.getByRole("textbox", { name: label, exact: true }).fill(value);
      await page.getByRole("button", { name: "Save", exact: true }).click();
    }
    await expect(page.getByRole("region", { name: "Still needed" })).toHaveCount(0);
    await expect(page.getByText("Every required answer is here. You can certify once you've checked the rest.")).toBeVisible();
  });

  // The first answer started the intake.
  await expect(page).toHaveURL(SESSION_URL);
  const sessionId = SESSION_URL.exec(page.url())![1];

  await test.step("the answers are saved and show everywhere at once", async () => {
    await expect
      .poll(async () => (await sql("SELECT chamber_data -> 'company_name' AS name, chamber_data -> 'states' AS states, chamber_data -> 'pay_frequency' AS pay FROM chamber_sessions WHERE id = $1", [sessionId]))[0])
      .toEqual({ name: "Quill & Ink Bindery", states: ["NY", "NJ"], pay: "Weekly" });
    await page.getByRole("button", { name: "② Company", exact: true }).click();
    await expect(page.getByText("Quill & Ink Bindery", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "③ Payroll", exact: true }).click();
    await expect(page.getByText("Weekly", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "⑨ The Reckoning", exact: true }).click();
    await expect(page.getByRole("heading", { name: "The Reckoning", exact: true })).toBeVisible();
    await expect(page.getByRole("alert", { name: "Answers still needed" })).toHaveCount(0);
  });
});

/** A guest who has verified an email, as the Reckoning's gate leaves them: allowed to certify. */
async function verifiedProspect(request: APIRequestContext) {
  const signup = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: {} });
  expect(signup).toBeOK();
  const { access_token: guestToken, user } = (await signup.json()) as { access_token: string; user: { id: string } };
  const email = `readiness+${Date.now()}@example.com`;
  const change = await request.put(`${GATEWAY_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${guestToken}` }, data: { email } });
  expect(change).toBeOK();
  const otp = await request.get(`${GATEWAY_URL}/__e2e/otp`, { params: { email } });
  const code = /\b\d{6}\b/.exec(await otp.text())![0];
  const verify = await request.post(`${GATEWAY_URL}/auth/v1/verify`, { headers: { apikey: ANON_KEY }, data: { type: "email_change", email, token: code } });
  expect(verify).toBeOK();
  const { access_token: token } = (await verify.json()) as { access_token: string };
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" };
  await agreeToIntakeConsentOverRest(request, headers);
  const created = await request.post(`${GATEWAY_URL}/rest/v1/chamber_sessions?select=id`, { headers, data: { user_id: user.id, chamber_data: {} } });
  expect(created).toBeOK();
  const [{ id }] = (await created.json()) as { id: string }[];
  const certify = (data: Record<string, unknown>) =>
    request.patch(`${GATEWAY_URL}/rest/v1/chamber_sessions?id=eq.${id}&select=id,status`, {
      headers,
      data: {
        status: "submitted",
        chamber_data: data,
        submission: {
          signer_name: "Jo Doe", signer_title: "CEO", signed_at: new Date().toISOString(), file_id: "EAA-TEST",
          consent_version: "2026-10-draft-1", consent_text: ["I certify."], chamber_data: data,
        },
      },
    });
  // An ordinary save, as the Chamber's autosave sends one.
  const save = (fields: Record<string, unknown>) =>
    request.patch(`${GATEWAY_URL}/rest/v1/chamber_sessions?id=eq.${id}&select=id,status`, { headers, data: fields });
  return { id, headers, certify, save };
}

test("the database refuses a certification without the required answers, and names them", async ({ request }) => {
  const { id, certify } = await verifiedProspect(request);

  const refused = await certify({ company_name: "Thin Co", states: ["NY"] });
  expect(refused.status()).toBe(400);
  expect(await refused.json()).toMatchObject({ code: "EA003", details: "pay_frequency" });
  expect(await sql("SELECT status FROM chamber_sessions WHERE id = $1", [id])).toEqual([{ status: "in_progress" }]);
  expect(await sql("SELECT count(*)::int AS n FROM chamber_certifications WHERE session_id = $1", [id])).toEqual([{ n: 0 }]);

  const accepted = await certify({ company_name: "Thin Co", states: ["NY"], pay_frequency: "weekly" });
  expect(accepted.status()).toBe(200);
  expect(await accepted.json()).toEqual([{ id, status: "submitted" }]);
});

test("the database refuses a certification while a required answer has two values, and names it", async ({ request }) => {
  const { id, certify, save } = await verifiedProspect(request);
  const answers = { company_name: "Two Names Co", states: ["NY"], pay_frequency: "weekly" };
  const source = { kind: "transcript", message_id: "m1" };
  const conflicting = {
    status: "conflicting", source, updated_at: new Date().toISOString(),
    candidates: [{ value: "Two Names Co", source }, { value: "Two Names LLC", source: { kind: "document", document_id: "d1" } }],
  };
  expect(await save({ chamber_data: answers, field_provenance: { company_name: conflicting } })).toBeOK();

  const refused = await certify(answers);
  expect(refused.status()).toBe(400);
  expect(await refused.json()).toMatchObject({ code: "EA008", details: "company_name" });
  expect(await sql("SELECT status, file_id FROM chamber_sessions WHERE id = $1", [id])).toEqual([{ status: "in_progress", file_id: null }]);
  expect(await sql("SELECT count(*)::int AS n FROM chamber_certifications WHERE session_id = $1", [id])).toEqual([{ n: 0 }]);

  // The prospect picks one, which confirms it, and certifying goes through.
  const picked = { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: new Date().toISOString() };
  expect(await save({ field_provenance: { company_name: picked } })).toBeOK();
  const accepted = await certify(answers);
  expect(accepted.status()).toBe(200);
  expect(await accepted.json()).toEqual([{ id, status: "submitted" }]);
});

test("a submission gets one File ID from the database, a repeat records nothing new, and nobody else can open it by that File ID", async ({ request }) => {
  const prospect = await verifiedProspect(request);
  const data = { company_name: "Twice Co", states: ["NY"], pay_frequency: "weekly" };
  const submission = {
    signer_name: "Jo Doe", signer_title: "CEO", signed_at: new Date().toISOString(), file_id: "EAA-TEST",
    consent_version: "2026-10-draft-1", consent_text: ["I certify."], chamber_data: data,
  };
  const certify = () =>
    request.patch(`${GATEWAY_URL}/rest/v1/chamber_sessions?id=eq.${prospect.id}&select=id,status,file_id,submission`, {
      headers: prospect.headers,
      data: { status: "submitted", chamber_data: data, submission },
    });

  const first = await certify();
  expect(first.status()).toBe(200);
  const [recorded] = (await first.json()) as { file_id: string; submission: { file_id: string; version: number } }[];
  // Not the one the browser sent: the database's, in its own form.
  expect(recorded.file_id).toMatch(/^EAA-\d{4}-\d{4,}$/);
  expect(recorded.submission).toMatchObject({ file_id: recorded.file_id, version: 1 });

  // The very same certification again (a second click, a retry): the record stands as it is.
  const again = await certify();
  expect(again.status()).toBe(200);
  const [repeat] = (await again.json()) as { file_id: string; submission: { version: number } }[];
  expect(repeat.file_id).toBe(recorded.file_id);
  expect(repeat.submission.version).toBe(1);
  expect(await sql("SELECT count(*)::int AS n FROM chamber_certifications WHERE session_id = $1", [prospect.id])).toEqual([{ n: 1 }]);

  // The owner opens it by File ID; another prospect, with a guessed File ID, gets nothing at all.
  const own = await request.get(`${GATEWAY_URL}/rest/v1/chamber_sessions?file_id=eq.${recorded.file_id}&select=id`, { headers: prospect.headers });
  expect(await own.json()).toEqual([{ id: prospect.id }]);
  const other = await verifiedProspect(request);
  const guessed = await request.get(`${GATEWAY_URL}/rest/v1/chamber_sessions?file_id=eq.${recorded.file_id}&select=id,chamber_data`, { headers: other.headers });
  expect(guessed.status()).toBe(200);
  expect(await guessed.json()).toEqual([]);
});

test("identical certifications sent at the same moment record one submission, one File ID and one set of emails", async ({ request }) => {
  const prospect = await verifiedProspect(request);
  const data = { company_name: "Race Co", states: ["NY"], pay_frequency: "weekly" };
  // As The Reckoning sends it: no File ID (the database assigns it), and no data_version filter, so nothing but the
  // database stands between the copies.
  const submission = {
    signer_name: "Jo Doe", signer_title: "CEO", signed_at: new Date().toISOString(),
    consent_version: "2026-10-draft-1", consent_text: ["I certify."], chamber_data: data,
  };
  const certify = () =>
    request.patch(`${GATEWAY_URL}/rest/v1/chamber_sessions?id=eq.${prospect.id}&select=id,status,file_id,submission`, {
      headers: prospect.headers,
      data: { status: "submitted", chamber_data: data, submission },
    });
  const COPIES = 4;

  // Hold the intake's row so every copy queues behind the same lock, then let them all go at once: a double click,
  // or a retry racing the request it retries, at its worst. Each copy is its own transaction on its own connection.
  const locker = new pg.Client({ ...PG, database: DATABASE });
  await locker.connect();
  let responses: Awaited<ReturnType<typeof certify>>[];
  try {
    await locker.query("BEGIN");
    await locker.query("SELECT 1 FROM chamber_sessions WHERE id = $1 FOR UPDATE", [prospect.id]);
    const lockerPid = (await locker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const sent = Array.from({ length: COPIES }, () => certify());
    await expect
      .poll(async () => (await sql<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = $1 AND pid <> $2 AND wait_event_type = 'Lock' AND query ILIKE '%UPDATE%chamber_sessions%'`,
        [DATABASE, lockerPid],
      ))[0].n, { timeout: 15_000 })
      .toBe(COPIES);
    await locker.query("COMMIT");
    responses = await Promise.all(sent);
  } finally {
    await locker.end().catch(() => {});
  }

  // Every copy is answered with the one certification on record.
  const rows = await Promise.all(responses.map(async (r) => {
    expect(r.status()).toBe(200);
    const [row] = (await r.json()) as { status: string; file_id: string; submission: { file_id: string; version: number } }[];
    return row;
  }));
  const [first] = rows;
  expect(first.file_id).toMatch(/^EAA-\d{4}-\d{4,}$/);
  for (const row of rows) {
    expect(row).toMatchObject({ status: "submitted", file_id: first.file_id, submission: { file_id: first.file_id, version: 1 } });
  }
  expect(await sql("SELECT count(*)::int AS n, min(file_id) AS file_id FROM chamber_certifications WHERE session_id = $1", [prospect.id]))
    .toEqual([{ n: 1, file_id: first.file_id }]);
  // One advisor alert and one confirmation, not one of each per copy.
  expect(await sql("SELECT kind FROM outbox_events WHERE session_id = $1 ORDER BY kind", [prospect.id]))
    .toEqual([{ kind: "advisor_notification" }, { kind: "prospect_confirmation" }]);
});
