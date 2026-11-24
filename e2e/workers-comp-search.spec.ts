import { expect, test } from "@playwright/test";
import { ANON_KEY, firmUrl, GATEWAY_URL } from "./stack/config.mjs";
import { PEO_AUTHORIZATION_VERSION, peoAuthorizationText } from "../src/data/legalWording";
import { accessToken, enterFirm, PASSWORD, signUpFirmFromNothing, withDb } from "./support/firms";

// A workers' comp search, in a firm made by sign-up (ADR 0029). An agent makes the opportunity as a workers' comp search on the screen; it is sent to a
// carrier and to no PEO; the carrier's quote is recorded on the workers' comp form, with a premium and no administrative fee; the comparison shows the
// premium; another firm reads none of it.
//
// What the browser does here: the account, the opportunity and its line, the choice of who to send to, recording the quote, and the comparison.
// What is placed for it, and why: the employer's side (their answers and their certification, which intake-to-pdf.spec.ts drives through the screens) is
// written to the database; the two markets and their profiles are the platform admin's to list; the send itself is the database function the screen
// calls, made over the API as the agent, because this stack has no file store for the bundle the screen uploads first.

const stamp = Date.now();
const FIRM = `Ridgeline Brokers ${stamp}`;
const ADDRESS = `ridgeline-brokers-${stamp}`;
const FOUNDER = `ridgeline-${stamp}@example.test`;
const EMPLOYER = `saltmarsh-owner-${stamp}@example.test`;
const OUTSIDER = `outsider-${stamp}@example.test`;
const ACCOUNT = `Saltmarsh Bakery ${stamp}`;
const CARRIER = `Granite Ridge Mutual ${stamp}`;
const PEO = `Harbor PEO ${stamp}`;
const FILE_ID = `EAA-2026-${String(stamp).slice(-4)}`;

const answers = { company_name: ACCOUNT, states: ["OR"], pay_frequency: "weekly", employee_count: 24 };

test("a workers' comp search is made, sent to a carrier, quoted with a premium and compared; a PEO is never offered and another firm sees none of it", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  let opportunityId = "";
  let intakeId = "";
  let quoteRequestId = 0;
  const asFounder = async () => ({ apikey: ANON_KEY, Authorization: `Bearer ${await accessToken(page)}`, "x-firm-address": ADDRESS, "Content-Type": "application/json" });
  try {
    await test.step("a broker signs their firm up, enters it, and Nevermore approves it and lists a carrier and a PEO", async () => {
      await signUpFirmFromNothing(page, FOUNDER, FIRM, ADDRESS);
      await enterFirm(page, ADDRESS, FOUNDER);
      await withDb(async (c) => {
        await c.query("UPDATE public.firms SET approved_at = now() WHERE address = $1", [ADDRESS]);
        for (const [name, line] of [[CARRIER, "workers_comp"], [PEO, "peo"]]) {
          const market = await c.query("INSERT INTO public.peos (name, line) VALUES ($1, $2) RETURNING id", [name, line]);
          await c.query(
            `INSERT INTO public.peo_profile_versions (peo_id, version, status, published_at, needed_to_quote, sources)
             VALUES ($1, 1, 'published', now(), ARRAY['company_name'], '{"answers": {"kind": "document", "name": "Submission checklist", "checked_on": "2026-11-01"}}'::jsonb)`,
            [market.rows[0].id],
          );
        }
      });
    });

    await test.step("they add an account and make a workers' comp search on it: the form offers the line, names the search for it, and the page says what it quotes", async () => {
      await page.goto(`${firmUrl(ADDRESS)}/accounts`);
      await page.getByRole("button", { name: "New account" }).first().click();
      const newAccount = page.getByRole("dialog");
      await newAccount.getByLabel("Account name").fill(ACCOUNT);
      await newAccount.getByRole("button", { name: "Save account" }).click();
      await expect(page.getByRole("heading", { level: 1, name: ACCOUNT })).toBeVisible();

      await page.getByRole("button", { name: "New opportunity" }).first().click();
      const form = page.getByRole("dialog", { name: "New opportunity" });
      await expect(form.getByLabel("What is being quoted")).toHaveValue("peo");
      await form.getByLabel("What is being quoted").selectOption("workers_comp");
      await expect(form.getByLabel("Opportunity name")).toHaveValue("Workers' comp search");
      await form.getByRole("button", { name: "Save opportunity" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Workers' comp search" })).toBeVisible();
      await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}/);
      opportunityId = /\/opportunities\/([0-9a-f-]{36})/.exec(page.url())![1];
      const details = page.getByRole("region", { name: "Details" });
      await expect(details.getByText("Quoting", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("Workers' comp");
      const stored = await withDb((c) => c.query("SELECT line FROM public.opportunities WHERE id = $1", [opportunityId]));
      expect(stored.rows).toEqual([{ line: "workers_comp" }]);
    });

    await test.step("the intake they start on it is a workers' comp intake; its employer certifies and authorizes the carrier, and cannot authorize the PEO", async () => {
      const started = await request.post(`${GATEWAY_URL}/rest/v1/rpc/start_broker_intake`, { headers: await asFounder(), data: { p_opportunity_id: opportunityId } });
      expect(started.status(), await started.text()).toBe(200);
      intakeId = ((await started.json()) as { intake_id: string }).intake_id;
      expect((await withDb((c) => c.query("SELECT line FROM public.chamber_sessions WHERE id = $1", [intakeId]))).rows).toEqual([{ line: "workers_comp" }]);

      // The employer: an account of their own, the intake handed to them and certified (placed: see the note at the top), at Ready for market.
      const signup = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email: EMPLOYER, password: PASSWORD } });
      expect(signup.status()).toBe(200);
      const { access_token: employerToken, user: employer } = (await signup.json()) as { access_token: string; user: { id: string } };
      const signedAt = new Date().toISOString();
      await withDb(async (c) => {
        await c.query("BEGIN");
        await c.query("SET LOCAL session_replication_role = replica");
        await c.query(
          "UPDATE public.chamber_sessions SET user_id = $2, status = 'submitted', file_id = $3, chamber_data = $4::jsonb, submission = $5::jsonb WHERE id = $1",
          [intakeId, employer.id, FILE_ID, JSON.stringify(answers), JSON.stringify({
            signer_name: "Wes Reyes", signer_title: "Owner", signed_at: signedAt, consent_version: "2026-10-draft-1", consent_text: ["I certify."], chamber_data: answers, file_id: FILE_ID, version: 1,
            // What a certification holds besides the answers: where each came from, and the documents on it (none). Without them the screens can't say what it held.
            field_provenance: {}, documents: [],
          })],
        );
        await c.query(
          `INSERT INTO public.chamber_certifications (session_id, user_id, signer_name, signer_title, consent_version, consent_text, signed_at, data_sha256, file_id, version, chamber_data, field_provenance, documents)
           VALUES ($1, $2, 'Wes Reyes', 'Owner', '2026-10-draft-1', 'I certify.', $3, 'e2e', $4, 1, $5::jsonb, '{}'::jsonb, '[]'::jsonb)`,
          [intakeId, employer.id, signedAt, FILE_ID, JSON.stringify(answers)],
        );
        await c.query("COMMIT");
        await c.query("UPDATE public.submission_workflow SET status = 'ready_for_market' WHERE session_id = $1", [intakeId]);
        await c.query(
          "INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv) SELECT id, 'google', email, 'https://www.googleapis.com/auth/gmail.send', 'sealed', 'iv' FROM auth.users WHERE email = $1",
          [FOUNDER],
        );
      });
      const authorize = (market: string) => request.post(`${GATEWAY_URL}/rest/v1/rpc/set_peo_authorization`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${employerToken}`, "Content-Type": "application/json" },
        data: { p_session_id: intakeId, p_peo: market, p_authorized: true, p_version: PEO_AUTHORIZATION_VERSION, p_text: peoAuthorizationText(market) },
      });
      // The employer is offered the carrier and no PEO, and the database refuses the PEO whatever is sent.
      const offered = await request.post(`${GATEWAY_URL}/rest/v1/rpc/peo_authorization_states`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${employerToken}`, "Content-Type": "application/json" }, data: { p_session_id: intakeId },
      });
      const names = ((await offered.json()) as { peo: string }[]).map((m) => m.peo);
      expect(names).toContain(CARRIER);
      expect(names).not.toContain(PEO);
      // Nothing offered is a PEO: every name is one the database lists as a workers' comp carrier (another run against the same stack lists its own).
      const carriers = await withDb((c) => c.query("SELECT name FROM public.peos WHERE line = 'workers_comp'"));
      expect(carriers.rows.map((r: { name: string }) => r.name)).toEqual(expect.arrayContaining(names));
      expect((await authorize(PEO)).status()).toBe(400);
      expect((await authorize(CARRIER)).status(), "the carrier is authorized").toBe(200);
    });

    await test.step("choosing who to send to offers the carrier and no PEO; the send to the carrier is recorded", async () => {
      await page.goto(`${firmUrl(ADDRESS)}/opportunities/${opportunityId}`);
      const quotes = page.getByRole("region", { name: /^Quotes/ });
      await expect(quotes.getByRole("button", { name: "Choose PEOs" })).toHaveCount(0);
      await quotes.getByRole("button", { name: "Choose carriers" }).click();
      const choosing = page.getByRole("region", { name: "Send to several carriers" });
      await expect(choosing.getByRole("checkbox", { name: CARRIER })).toBeChecked();
      await expect(choosing.getByRole("checkbox", { name: PEO })).toHaveCount(0);

      // The send as the screen makes it once the bundle is stored (send_to_peo), over the API as the agent. To the PEO it is refused: the employer never
      // authorized it, and could not have.
      const send = async (market: string) => request.post(`${GATEWAY_URL}/rest/v1/rpc/send_to_peo`, {
        headers: await asFounder(),
        data: { p_session_id: intakeId, p_peo: market, p_to: ["underwriting@granite.example"], p_subject: `${ACCOUNT}: ${FILE_ID}`, p_note: "Here is Saltmarsh Bakery." },
      });
      expect((await send(PEO)).status()).toBe(400);
      // BR-2.2: with no property and casualty licence on record the send to the carrier is refused, in words the composer shows, and records nothing.
      const unlicensed = await send(CARRIER);
      expect(unlicensed.status()).not.toBe(200);
      expect(await unlicensed.text()).toContain("Your firm has no property and casualty licence on record.");
      expect((await withDb((c) => c.query("SELECT count(*)::int AS n FROM public.quote_requests WHERE session_id = $1", [intakeId]))).rows).toEqual([{ n: 0 }]);
      // The founder, an owner, records the firm's licence in Settings; the page then stops saying nothing can be sent to a carrier.
      await page.goto(`${firmUrl(ADDRESS)}/settings`);
      const licences = page.getByRole("region", { name: "Licences" });
      await expect(licences.getByText("No property and casualty licence is on record, so nothing can be sent to a carrier yet.")).toBeVisible();
      await licences.getByLabel("State (required)").fill("tx");
      await licences.getByRole("button", { name: "Add licence" }).click();
      await expect(licences.getByRole("list", { name: "Licences on record" })).toContainText("TX · Property and casualty");
      await expect(licences.getByText("No property and casualty licence is on record, so nothing can be sent to a carrier yet.")).toHaveCount(0);
      await page.goto(`${firmUrl(ADDRESS)}/opportunities/${opportunityId}`);
      const sent = await send(CARRIER);
      expect(sent.status(), await sent.text()).toBe(200);
      quoteRequestId = ((await sent.json()) as { quote_request_id: number }).quote_request_id;
    });

    await test.step("the opportunity lists the request under Carrier, and its page records the carrier's quote on the workers' comp form", async () => {
      await page.reload();
      const quotes = page.getByRole("region", { name: /^Quotes/ });
      await expect(quotes.getByRole("columnheader", { name: "Carrier" })).toBeVisible();
      await expect(quotes.getByRole("columnheader", { name: "Admin fee" })).toHaveCount(0);
      await quotes.getByRole("link", { name: CARRIER }).click();
      await expect(page).toHaveURL(new RegExp(`/quotes/${quoteRequestId}$`));
      await expect(page.getByRole("region", { name: "Details" }).getByText("Carrier contact")).toBeVisible();

      await page.getByRole("button", { name: "Record the quote" }).click();
      const form = page.getByRole("form", { name: `Record the quote from ${CARRIER}` });
      await expect(form.getByLabel("Admin fee")).toHaveCount(0);
      await form.getByLabel("Estimate or firm offer").selectOption("firm_offer");
      await form.getByLabel("Annual premium").fill("18450");
      await form.getByLabel("Experience modification").fill("0.92");
      await form.getByLabel("Minimum premium").fill("1500");
      await form.getByRole("button", { name: "Save the quote" }).click();
      const figures = page.getByRole("region", { name: "Quote", exact: true });
      await expect(figures.getByText("Annual premium").locator("xpath=following-sibling::dd")).toHaveText("$18,450");
      await expect(figures.getByText("Experience modification").locator("xpath=following-sibling::dd")).toHaveText("0.92");
      await expect(figures.getByText("Minimum premium").locator("xpath=following-sibling::dd")).toHaveText("$1,500");
      await expect(figures.getByText("Admin fee")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Details" }).getByText("Status").locator("xpath=following-sibling::dd")).toHaveText("Quoted");
      const stored = await withDb((c) => c.query("SELECT annual_premium::float AS premium, experience_mod::float AS mod, minimum_premium::float AS minimum, admin_fee FROM public.quotes WHERE quote_request_id = $1", [quoteRequestId]));
      expect(stored.rows).toEqual([{ premium: 18450, mod: 0.92, minimum: 1500, admin_fee: null }]);
    });

    await test.step("the comparison has a workers' comp quote's rows, with the carrier's premium", async () => {
      await page.goto(`${firmUrl(ADDRESS)}/opportunities/${opportunityId}`);
      const table = page.getByRole("table", { name: "Quotes side by side" });
      await expect(table.getByRole("rowheader")).toHaveText(["Status", "Expires", "Annual premium", "Workers' comp", "Experience modification", "Minimum premium", "One-off fees"]);
      await expect(table.getByRole("row", { name: /Annual premium/ }).getByRole("cell")).toHaveText(["$18,450.00 a year"]);
    });

    await test.step("someone of no firm, and so of another, reads none of it over the API with their own sign-in", async () => {
      const signup = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: { apikey: ANON_KEY }, data: { email: OUTSIDER, password: PASSWORD } });
      const { access_token: token } = (await signup.json()) as { access_token: string };
      for (const address of [ADDRESS, ""]) {
        const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, ...(address ? { "x-firm-address": address } : {}) };
        for (const table of ["opportunities", "quote_requests", "quotes"]) {
          const res = await request.get(`${GATEWAY_URL}/rest/v1/${table}?select=id`, { headers });
          expect(await res.json(), `${table} read by an outsider at "${address}"`).toEqual([]);
        }
      }
      // The agent reads the quote by the same request, so the empty answers above are the rule's doing.
      const mine = await request.get(`${GATEWAY_URL}/rest/v1/quotes?select=quote_request_id`, { headers: await asFounder() });
      expect(await mine.json()).toEqual([{ quote_request_id: quoteRequestId }]);
    });
  } finally {
    await context.close();
  }
});
