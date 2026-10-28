import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";
import { consentStatements } from "../src/data/certification";
import { manuscriptFilename } from "../src/data/manuscript";
import { DATABASE, GATEWAY_URL, PG } from "./stack/config.mjs";
import { COMPANY_NAME, INTAKE_EXTRACTION, INTAKE_MESSAGE } from "./stack/intake-script.mjs";
import { pdfText } from "./support/pdf";

const PEO = "Justworks";
const SIGNER = { name: "Edgar Poe", role: "CEO" };
const TARGET_START = "January 2027";
const SESSION_URL = /\/start\?session=([0-9a-f-]{36})$/;
const GENERATED_FILE_ID = /^File ID: (EAA-\d{4}-[0-9A-F]{8})$/;

/** One entry of the gateway's request log, in the order the gateway saw them. */
interface LoggedRequest {
  method: string;
  path: string;
  status: number;
}

/**
 * Everything the happy path must not produce: console errors, uncaught exceptions, failed requests and
 * error responses from the gateway. The one expected failure is a wrong email code, which the gateway
 * rejects with a 403 on /auth/v1/verify (and the browser reports as a console error).
 */
function recordProblems(page: Page): string[] {
  const problems: string[] = [];
  const verifyUrl = `${GATEWAY_URL}/auth/v1/verify`;
  // The page links Google Fonts, which a sandboxed or offline run cannot reach.
  const isFont = (url: string) => /^https:\/\/fonts\.g(oogleapis|static)\.com\//.test(url);

  page.on("console", (message) => {
    const { url } = message.location();
    const wrongCodeRejection = url === verifyUrl && message.text().includes("403");
    if (message.type() === "error" && !isFont(url) && !wrongCodeRejection) problems.push(`console error: ${message.text()} (${url})`);
  });
  page.on("pageerror", (error) => problems.push(`uncaught exception: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (!isFont(request.url())) problems.push(`request failed: ${request.method()} ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    const wrongCodeRejection = response.url() === verifyUrl && response.status() === 403;
    if (response.url().startsWith(GATEWAY_URL) && response.status() >= 400 && !wrongCodeRejection) {
      problems.push(`${response.status()} from ${response.request().method()} ${response.url()}`);
    }
  });
  return problems;
}

async function queryDatabase<Row>(sql: string, params: unknown[]): Promise<Row[]> {
  const client = new pg.Client({ ...PG, database: DATABASE });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}

/** The email code the gateway would have sent. Read once the app says "We sent a code". */
async function readEmailCode(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.get(`${GATEWAY_URL}/__e2e/otp`, { params: { email } });
  expect(response, "the gateway has a code for the address").toBeOK();
  const code = /\b\d{6}\b/.exec(await response.text())?.[0];
  expect(code, "the gateway's answer contains a 6-digit code").toBeDefined();
  return code!;
}

async function readRequestLog(request: APIRequestContext): Promise<LoggedRequest[]> {
  const response = await request.get(`${GATEWAY_URL}/__e2e/requests`);
  expect(response).toBeOK();
  return (await response.json()) as LoggedRequest[];
}

const isCall = (method: string, path: string) => (logged: LoggedRequest) => logged.method === method && logged.path.split("?")[0] === path;

test("a guest's text intake becomes a certified, downloadable Manuscript", async ({ page, request }, testInfo) => {
  const problems = recordProblems(page);
  const email = `e2e+${Date.now()}@example.com`;
  // The gateway's log spans every test run since it started, so this test reads only what follows this point.
  const firstOwnRequest = (await readRequestLog(request)).length;

  const sessionId = await test.step("Open the Chamber as a guest", async () => {
    await page.goto("/start");
    // The page redirects to ?session=<id> once the guest's session row exists.
    await expect(page).toHaveURL(SESSION_URL);
    return SESSION_URL.exec(page.url())![1];
  });

  await test.step("Tell Lenore about the company", async () => {
    const chat = page.getByPlaceholder("Type a message...");
    await chat.fill(INTAKE_MESSAGE);
    await chat.press("Enter");
    await expect(chat).toHaveValue("");
    // Extracted values are applied before the reply is shown, so the reply is the point to continue
    // from. It appears twice (the transcript and the voice orb's caption).
    await expect(page.getByText(INTAKE_EXTRACTION.reply).first()).toBeVisible();
  });

  await test.step("Check the Company tab, confirm the inferred industry and add a target start", async () => {
    await page.getByRole("button", { name: "② Company", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Company Profile" })).toBeVisible();
    await expect(page.getByText(COMPANY_NAME, { exact: true })).toBeVisible();
    await expect(page.getByText(INTAKE_EXTRACTION.industry, { exact: true })).toBeVisible();
    await expect(page.getByText(String(INTAKE_EXTRACTION.employee_count), { exact: true })).toBeVisible();
    // HQ State and All States both read "NY".
    await expect(page.getByText(INTAKE_EXTRACTION.hq_state, { exact: true })).toHaveCount(2);
    await expect(page.getByText("5 of 7 fields captured")).toBeVisible();

    // Industry is the one value Lenore inferred rather than read from the message.
    await expect(page.getByText("Lenore inferred this")).toHaveCount(1);
    await page.getByRole("button", { name: "Confirm Industry", exact: true }).click();
    await expect(page.getByText("Lenore inferred this")).toHaveCount(0);
    await expect(page.getByText("You confirmed this")).toHaveCount(1);

    await page.getByRole("button", { name: "Add Target Start", exact: true }).click();
    await page.getByRole("textbox", { name: "Target Start", exact: true }).fill(TARGET_START);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(TARGET_START, { exact: true })).toBeVisible();
    await expect(page.getByText("6 of 7 fields captured")).toBeVisible();
  });

  await test.step("Review the intake", async () => {
    await page.getByRole("button", { name: "⑦ Review", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
    await expect(page.getByText(COMPANY_NAME, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "See Your PEO Matches →", exact: true }).click();
  });

  await test.step(`Choose ${PEO}`, async () => {
    await expect(page.getByRole("heading", { name: "PEO Match", exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Choose ${PEO}`, exact: true }).click();
    await expect(page.getByText("✓ Selected")).toBeVisible();
    await page.getByRole("button", { name: `Proceed with ${PEO} →`, exact: true }).click();
    await expect(page.getByRole("heading", { name: "The Reckoning", exact: true })).toBeVisible();
  });

  // The Reckoning forgets what was entered when the tab is left, so everything from here to
  // "Generate" happens in one visit.
  await test.step("Acknowledge each statement", async () => {
    for (const statement of consentStatements(PEO)) {
      // The checkbox is visually hidden, so the visible label is what a person clicks.
      await page.getByText(statement, { exact: true }).click();
      await expect(page.getByRole("checkbox", { name: statement, exact: true })).toBeChecked();
    }
  });

  await test.step("Verify the email address", async () => {
    // While the user is a guest, the gate stands in for the signature and the Generate button.
    await expect(page.getByRole("heading", { name: "Verify your email to certify" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate The Manuscript →" })).toHaveCount(0);

    await page.getByLabel("Work email").fill(email);
    await page.getByRole("button", { name: "Send code", exact: true }).click();
    await expect(page.getByText(`We sent a code to ${email}.`)).toBeVisible();
    const code = await readEmailCode(request, email);

    // A code that is off by one digit must be refused, or the gate proves nothing.
    const codeField = page.getByLabel("6-digit code");
    await codeField.fill(code.slice(0, 5) + ((Number(code[5]) + 1) % 10));
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByText("That code didn't work")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verify your email to certify" })).toBeVisible();

    await codeField.fill(code);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Verify your email to certify" })).toHaveCount(0);
    for (const statement of consentStatements(PEO)) {
      await expect(page.getByRole("checkbox", { name: statement, exact: true })).toBeChecked();
    }
  });

  await test.step("Sign", async () => {
    await page.getByRole("textbox", { name: "Full name", exact: true }).fill(SIGNER.name);
    await page.getByRole("textbox", { name: "Role", exact: true }).fill(SIGNER.role);
    await page.getByRole("button", { name: "Click to sign digitally", exact: true }).click();
    await expect(page.getByText(`${SIGNER.name}, ${SIGNER.role}`, { exact: true })).toBeVisible();
    await expect(page.getByTestId("certification-blockers")).toHaveCount(0);
  });

  const requestsBeforeSubmit = (await readRequestLog(request)).length;

  const fileId = await test.step("Generate The Manuscript", async () => {
    const generate = page.getByRole("button", { name: "Generate The Manuscript →", exact: true });
    await expect(generate).toBeEnabled();
    await generate.click();

    await expect(page.getByRole("heading", { name: "The Raven has spoken." })).toBeVisible();
    const shown = GENERATED_FILE_ID.exec((await page.getByText(GENERATED_FILE_ID).textContent())!)![1];

    // Built here rather than with the app's fileIdForSession, so a regression in it is caught. The year
    // is the browser's: the app stamps the File ID with the signer's local clock.
    const year = await page.evaluate(() => new Date().getFullYear());
    const expected = `EAA-${year}-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    expect(shown).toBe(expected);
    return expected;
  });

  await test.step("Check what the database recorded", async () => {
    const [session] = await queryDatabase<{ status: string; file_id: string; signer_name: string; signer_title: string }>(
      `SELECT status, submission ->> 'file_id' AS file_id, submission ->> 'signer_name' AS signer_name,
              submission ->> 'signer_title' AS signer_title
         FROM chamber_sessions WHERE id = $1`,
      [sessionId],
    );
    expect(session).toEqual({ status: "submitted", file_id: fileId, signer_name: SIGNER.name, signer_title: SIGNER.role });

    const certifications = await queryDatabase<{ file_id: string; signer_name: string; superseded_at: Date | null }>(
      "SELECT file_id, signer_name, superseded_at FROM chamber_certifications WHERE session_id = $1",
      [sessionId],
    );
    expect(certifications).toEqual([{ file_id: fileId, signer_name: SIGNER.name, superseded_at: null }]);

    // Queued by the certification itself, in its transaction: one alert for the advisor, one receipt for the prospect.
    const outbox = await queryDatabase<{ kind: string; payload: Record<string, unknown> }>(
      "SELECT kind, payload FROM outbox_events WHERE session_id = $1 ORDER BY kind",
      [sessionId],
    );
    expect(outbox.map((event) => event.kind)).toEqual(["advisor_notification", "prospect_confirmation"]);
    expect(outbox[0].payload).toMatchObject({ reference: fileId, company_name: COMPANY_NAME, contact_email: email });
    expect(outbox[1].payload).toMatchObject({ reference: fileId, company_name: COMPANY_NAME, recipient_email: email, recipient_name: SIGNER.name });
  });

  await test.step("Check the calls the gateway saw", async () => {
    const callsTo = async (method: string, path: string, from: number, to?: number) =>
      (await readRequestLog(request)).slice(from, to).filter(isCall(method, path));

    // The browser tells dispatch-outbox to send the queue only once the submission has gone through, and
    // does not wait for it, so the call may land just after the confirmation appears.
    const dispatch = "/functions/v1/dispatch-outbox";
    await expect.poll(async () => (await callsTo("POST", dispatch, requestsBeforeSubmit)).length).toBeGreaterThan(0);
    expect((await callsTo("POST", dispatch, requestsBeforeSubmit)).map((call) => call.status < 400)).not.toContain(false);
    expect(await callsTo("POST", dispatch, firstOwnRequest, requestsBeforeSubmit)).toEqual([]);

    expect((await callsTo("POST", "/functions/v1/chamber-extract", firstOwnRequest)).map((call) => call.status)).toContain(200);
  });

  await test.step("Open the Manuscript", async () => {
    await page.getByRole("link", { name: "Download The Manuscript", exact: true }).click();
    await expect(page).toHaveURL(`/manuscript?session=${sessionId}`);
    await expect(page.getByRole("heading", { name: "THE MANUSCRIPT", exact: true })).toBeVisible();
    await expect(page.getByText(fileId, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(COMPANY_NAME, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`Signed electronically by ${SIGNER.name}`)).toBeVisible();
    await expect(page.getByText(`${PEO} — Underwriting`)).toBeVisible();
  });

  await test.step("Download the PDF", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      // The top bar and the foot of the page each have the button.
      page.getByRole("button", { name: "Download The Manuscript (PDF)" }).first().click(),
    ]);

    const expectedName = `The_Manuscript_${fileId}_Ravenwood_Bindery_LLC.pdf`;
    expect(download.suggestedFilename()).toBe(expectedName);
    expect(manuscriptFilename(fileId, COMPANY_NAME)).toBe(expectedName);

    const pdfPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(pdfPath);
    const pdf = await readFile(pdfPath);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const text = pdfText(pdf);
    expect(text).toContain(fileId);
    expect(text).toContain(COMPANY_NAME);
    expect(text).toContain(SIGNER.name);
    expect(text).toContain(PEO);
  });

  expect(problems, "console errors, failed requests and gateway errors").toEqual([]);
});
