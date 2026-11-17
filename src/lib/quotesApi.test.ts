import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { QUOTE_FIELDS, QUOTE_ROW_KEYS, QUOTE_ROW_STATUSES, countQuoteViews, listQuotes } = await import("./quotesApi");
type QuoteFilter = import("./quotesApi").QuoteFilter;

beforeEach(() => rpc.mockReset());

// A whole row, as the database sends it (quotes_row): every column, null where there is nothing.
const row = {
  key: "q5", quote_request_id: 5, opportunity_id: "o1", account_id: "a1", account_name: "Reyes Bakery", opportunity_name: "PEO search 2026", target_start: "2027-01-01",
  peo: "TriNet", status: "quoted", sent_on: "2026-11-01", sent_version: 1, admin_fee_pepm: 32.5, expires_on: "2026-12-01", proposed_start: null, file_id: "EAA-2026-0001",
  owner: "u1", owner_name: "Dana Reyes", new_mail: false, emails: 2, last_message_at: "2026-11-10T00:00:00+00:00",
};

describe("listQuotes", () => {
  // Catches: a call that drops the firm, sends the search untrimmed, or names an argument the database does not have.
  it("sends the firm, filters, sort, page, search and time zone, and reads the page", async () => {
    rpc.mockResolvedValue({ data: { rows: [row], total: 51, page: 2, page_size: 50 }, error: null });
    const filters: QuoteFilter[] = [{ field: "status", op: "any_of", value: ["sent", "quoted"] }, { field: "owner", op: "me" }];
    const page = await listQuotes({ firmId: "f1", filters, sort: { field: "peo", direction: "desc" }, page: 2, search: "  reyes ", timeZone: "America/Chicago" });
    expect(rpc).toHaveBeenCalledWith("quotes_list", {
      p_firm_id: "f1", p_filters: filters, p_sort: "peo", p_direction: "desc", p_page: 2, p_search: "reyes", p_time_zone: "America/Chicago",
    });
    expect(page).toEqual({ rows: [row], total: 51, page: 2, pageSize: 50 });
  });
});

describe("listQuotes refusals", () => {
  // Catches: an answer of another shape shown as "no quotes".
  it("fails, plainly, for an answer that is not a page of quotes", async () => {
    rpc.mockResolvedValue({ data: { rows: [{ ...row, status: "won" }], total: 1, page: 1, page_size: 50 }, error: null });
    await expect(listQuotes({ firmId: "f1" })).rejects.toThrow("Couldn't load quotes.");
  });

  // Catches: the database's reason for refusing dropped.
  it("passes on a refusal in words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "no" } });
    await expect(listQuotes({ firmId: "f1" })).rejects.toThrow("You don't have access to this firm's records.");
  });
});

describe("countQuoteViews", () => {
  // Catches: a tab count that is not asked under the same firm, search and time zone as the list, or answered out of order.
  it("asks for every view's count in one call and answers in the order asked", async () => {
    rpc.mockResolvedValue({ data: [{ view_name: "Open", total: 3 }, { view_name: "Quoted", total: "2" }], error: null });
    const views = [{ name: "Open", filters: [] }, { name: "Quoted", filters: [{ field: "status", op: "any_of", value: ["quoted"] }] as QuoteFilter[] }];
    expect(await countQuoteViews("f1", views, { search: " a ", timeZone: "UTC" })).toEqual([{ name: "Open", total: 3 }, { name: "Quoted", total: 2 }]);
    expect(rpc).toHaveBeenCalledWith("quotes_view_counts", { p_firm_id: "f1", p_views: views, p_search: "a", p_time_zone: "UTC" });
  });
});

// The database refuses a field it doesn't list, so the browser's lists must be the database's (sync blocks in the migration).
describe("the quotes table's fields agree with the database", () => {
  const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"));
  const block = (name: string) => {
    const re = new RegExp(`--\\s*sync:begin ${name}\\s*\\n([\\s\\S]*?)--\\s*sync:end ${name}\\b`);
    const m = migrations.filter((x) => re.test(x)).map((x) => x.match(re)!).at(-1);
    expect(m, `sync block ${name}`).toBeDefined();
    return m![1];
  };

  // Catches: a field the page offers that the database refuses, or one it has that the page can't use.
  it("names the same fields with the same kinds", () => {
    const server = Object.fromEntries([...block("quotes_fields").matchAll(/WHEN '(\w+)' THEN '(\w+)'/g)].map((m) => [m[1], m[2]]));
    expect(server).toEqual(QUOTE_FIELDS);
  });

  // Catches: a status the page can't read, so a row reads as a failed load.
  it("lists the same statuses, in the same order", () => {
    expect([...QUOTE_ROW_STATUSES]).toEqual([...block("quotes_statuses").matchAll(/'([^']+)'/g)].map((m) => m[1]));
  });

  // Catches: a column the database adds and the page's reader drops.
  it("has a row of the same columns as the database's, in its order, and the test's row is that row", () => {
    const sql = readFileSync("supabase/migrations/20261123180000_quotes_table.sql", "utf8");
    const body = sql.match(/CREATE TYPE public\.quotes_row AS \(([\s\S]*?)\n\);/);
    expect(body).not.toBeNull();
    const created = body![1].split("\n").map((l) => l.trim().match(/^(\w+) /)?.[1]).filter((c): c is string => c !== undefined);
    expect([...QUOTE_ROW_KEYS]).toEqual(created);
    expect(Object.keys(row)).toEqual(created);
  });
});
