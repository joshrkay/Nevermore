import { expect, test } from "@playwright/test";
import { firmUrl } from "./stack/config.mjs";
import { enterFirm, signUpFirmFromNothing, withDb } from "./support/firms";

// The reports (BR-6.1, CRM-R1.1), in a firm made by sign-up. Its owner opens Reports from the menu with nothing in the firm, then with an account that has
// an open search, a lost one, a renewal next month and a placement with commission expected: each report says what the real database function counted.

const stamp = Date.now();
const FIRM = `Reporting Brokers ${stamp}`;
const ADDRESS = `reporting-brokers-${stamp}`;
const FOUNDER = `reporter-${stamp}@example.test`;
const ACCOUNT = `Reyes Bakery ${stamp}`;

test("an owner reads the firm's reports: empty at first, then what the records add up to", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signUpFirmFromNothing(page, FOUNDER, FIRM, ADDRESS);
    await enterFirm(page, ADDRESS, FOUNDER);

    await test.step("a firm with nothing reads five reports, each saying so", async () => {
      await page.goto(`${firmUrl(ADDRESS)}/home`);
      await page.getByRole("link", { name: "Reports" }).click();
      await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();
      const pipeline = page.getByRole("region", { name: "Pipeline" });
      await expect(pipeline.getByText("Nothing is open.")).toBeVisible();
      await expect(page.getByRole("region", { name: "Quotes by market" }).getByText("Nothing was sent to a PEO or carrier in this period.")).toBeVisible();
      await expect(page.getByRole("region", { name: "Won and lost" }).getByText("Nothing was won or lost in this period.")).toBeVisible();
      await expect(page.getByRole("region", { name: "Renewals" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Commission" })).toBeVisible();
    });

    await test.step("records are made in the firm", async () => {
      await withDb(async (c) => {
        const firm = (await c.query("SELECT f.id, m.user_id FROM public.firms f JOIN public.firm_memberships m ON m.firm_id = f.id WHERE f.address = $1 LIMIT 1", [ADDRESS])).rows[0];
        const account = (await c.query("INSERT INTO public.accounts (firm_id, owner_id, name, source) VALUES ($1, $2, $3, 'added_by_hand') RETURNING id", [firm.id, firm.user_id, ACCOUNT])).rows[0].id;
        await c.query("INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, value) VALUES ($1, $2, $3, 'Open search', 8000)", [firm.id, account, firm.user_id]);
        await c.query(
          "INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, lost_at, lost_by, lost_reason) VALUES ($1, $2, $3, 'Lost search', now() - interval '1 hour', $3, 'price')",
          [firm.id, account, firm.user_id]);
        await c.query(
          "INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) VALUES ($1, $2, 'current_plan', 'Old PEO', (date_trunc('month', current_date) + interval '1 month')::date)",
          [firm.id, account]);
        const placement = (await c.query(
          `INSERT INTO public.placements (firm_id, account_id, peo_name, start_date, commission_basis, commission_rate, commission_expected_yearly)
           VALUES ($1, $2, 'Harbor PEO', date_trunc('month', current_date)::date, 'flat', 1200, 1200) RETURNING id`, [firm.id, account])).rows[0].id;
        await c.query("INSERT INTO public.commission_payments (firm_id, account_id, placement_id, received_on, amount) VALUES ($1, $2, $3, current_date, 75)", [firm.id, account, placement]);
      });
    });

    await test.step("this month's reports count them, and each record opens", async () => {
      await page.reload();
      await page.getByRole("button", { name: "This month" }).click();
      const pipeline = page.getByRole("region", { name: "Pipeline" });
      await expect(pipeline.getByText("$8,000").first()).toBeVisible();
      await expect(pipeline.getByRole("row", { name: /Qualifying/ })).toContainText("1");
      await expect(pipeline.getByRole("link", { name: "Open search" })).toBeVisible();
      const wonLost = page.getByRole("region", { name: "Won and lost" });
      await expect(wonLost.getByRole("table", { name: "Lost because" }).getByRole("row", { name: /Price/ })).toContainText("1");
      await expect(wonLost.getByRole("link", { name: "Lost search" })).toBeVisible();
      const renewals = page.getByRole("region", { name: "Renewals" });
      await expect(renewals.getByRole("table").getByRole("row").nth(2)).toContainText("1");
      const commission = page.getByRole("region", { name: "Commission" });
      await expect(commission.getByRole("table", { name: "By placement" }).getByRole("row", { name: new RegExp(ACCOUNT) })).toContainText("Harbor PEO$100$75");
    });

    await test.step("a report's table is saved as a CSV named for the report and its period", async () => {
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export Commission as CSV" }).click()]);
      expect(download.suggestedFilename()).toMatch(/^commission-\d{4}-\d{2}-01-to-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    await test.step("the intake funnel is one link away, and Reports stays marked in the menu", async () => {
      await page.getByRole("link", { name: "Intake funnel" }).click();
      await expect(page).toHaveURL(/\/advisor\/funnel/);
    });
  } finally {
    await context.close();
  }
});
