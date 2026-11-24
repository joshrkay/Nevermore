import { expect, test } from "@playwright/test";
import { firmUrl } from "./stack/config.mjs";
import { enterFirm, signUpFirmFromNothing, withDb } from "./support/firms";

// Importing a book (CRM-X4.1, BR-5.1), in a firm made by sign-up. Its owner chooses a CSV of accounts with their contacts, reads the proposed matching and
// the review, imports, finds the accounts on the Accounts page with the contact and the renewal each row held, and undoes the import. Nothing is seeded in
// the firm: every record here is made by the import, through the real database functions.

const stamp = Date.now();
const FIRM = `Importing Brokers ${stamp}`;
const ADDRESS = `importing-brokers-${stamp}`;
const FOUNDER = `importer-${stamp}@example.test`;
const GOOD = `Cole Plumbing ${stamp}`;
const SECOND = `Reyes Bakery ${stamp}`;

const CSV = [
  "Company,State,# of Employees,Current PEO,Renewal Date,First Name,Last Name,Email",
  `${GOOD},TX,40,Old PEO,1/15/2027,Dana,Cole,dana-${stamp}@cole.example`,
  `"${SECOND}",OK,12,,,,,`,
  `Bad Row ${stamp},TX,many,,,,,`,
  "",
].join("\r\n");

test("an owner imports accounts from a CSV, finds them with their contact and renewal, and undoes the import", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signUpFirmFromNothing(page, FOUNDER, FIRM, ADDRESS);
    await enterFirm(page, ADDRESS, FOUNDER);

    await test.step("a new firm's Home offers the import to its owner", async () => {
      await page.goto(`${firmUrl(ADDRESS)}/home`);
      await page.getByRole("link", { name: "Import a CSV" }).click();
      await expect(page.getByRole("heading", { name: "Import", level: 1 })).toBeVisible();
    });

    await test.step("the file's columns are matched, and the review says what each row will do before anything is made", async () => {
      await page.getByLabel("CSV file").setInputFiles({ name: "book.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });
      await expect(page.getByLabel("Field for Company")).toHaveValue("name");
      await expect(page.getByLabel("Field for # of Employees")).toHaveValue("employees");
      await expect(page.getByLabel("Field for Current PEO")).toHaveValue("current_provider");
      await expect(page.getByLabel("Field for Email")).toHaveValue("contact_email");
      await page.getByRole("button", { name: "Check the file" }).click();
      const will = page.getByRole("list", { name: "What the import will do" });
      await expect(will).toContainText("2 rows will make a new account.");
      await expect(will).toContainText("1 can't be imported.");
      await expect(page.getByRole("list", { name: "Rows that won't be imported" })).toContainText("Row 4: Employees must be a whole number, like 25");
      // The review made nothing.
      const before = await withDb((c) => c.query("SELECT count(*)::int AS n FROM public.accounts a JOIN public.firms f ON f.id = a.firm_id WHERE f.address = $1", [ADDRESS]));
      expect(before.rows).toEqual([{ n: 0 }]);
    });

    await test.step("the import makes the two accounts, with the contact and the renewal the first row held", async () => {
      await page.getByRole("button", { name: "Import 2 rows" }).click();
      await expect(page.getByText("2 made, 0 already here, 1 not imported.")).toBeVisible();
      const made = await withDb((c) => c.query(
        `SELECT a.name, a.source, a.employees,
                (SELECT k.email FROM public.contacts k WHERE k.account_id = a.id AND k.is_main) AS contact,
                (SELECT r.renews_on::text || ' ' || r.with_whom FROM public.renewals r WHERE r.account_id = a.id) AS renewal
           FROM public.accounts a JOIN public.firms f ON f.id = a.firm_id WHERE f.address = $1 ORDER BY a.name`, [ADDRESS]));
      expect(made.rows).toEqual([
        { name: GOOD, source: "import", employees: 40, contact: `dana-${stamp}@cole.example`, renewal: "2027-01-15 Old PEO" },
        { name: SECOND, source: "import", employees: 12, contact: null, renewal: null },
      ]);
      await page.getByRole("link", { name: "Open Accounts" }).click();
      await expect(page.getByRole("link", { name: GOOD })).toBeVisible();
      await expect(page.getByRole("link", { name: SECOND })).toBeVisible();
    });

    await test.step("the same file again makes nothing: both accounts are already here", async () => {
      await page.goto(`${firmUrl(ADDRESS)}/import`);
      await page.getByLabel("CSV file").setInputFiles({ name: "book.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });
      await page.getByRole("button", { name: "Check the file" }).click();
      await expect(page.getByRole("list", { name: "What the import will do" })).toContainText("2 already here, and will be left as they are.");
      await expect(page.getByText("Nothing in this file would make a new record.")).toBeVisible();
    });

    await test.step("the import is listed with what it made, and undoing it removes both accounts", async () => {
      const row = page.getByRole("list", { name: "Imports" }).getByRole("listitem").filter({ hasText: "book.csv" });
      await expect(row).toContainText("2 made, 0 already here, 1 not imported");
      await row.getByRole("button", { name: "Undo the import of book.csv" }).click();
      await expect(row).toContainText("Undone");
      const after = await withDb((c) => c.query(
        `SELECT (SELECT count(*)::int FROM public.accounts a WHERE a.firm_id = f.id) AS accounts, (SELECT count(*)::int FROM public.contacts k WHERE k.firm_id = f.id) AS contacts,
                (SELECT count(*)::int FROM public.renewals r WHERE r.firm_id = f.id) AS renewals FROM public.firms f WHERE f.address = $1`, [ADDRESS]));
      expect(after.rows).toEqual([{ accounts: 0, contacts: 0, renewals: 0 }]);
    });
  } finally {
    await context.close();
  }
});
