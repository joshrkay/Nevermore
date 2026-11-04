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
  await expect(page).toHaveURL(SESSION_URL);
  const sessionId = SESSION_URL.exec(page.url())![1];

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
  return { id, certify };
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
