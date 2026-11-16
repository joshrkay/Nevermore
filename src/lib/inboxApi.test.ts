import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { INBOX_DIRECTIONS, INBOX_FIELDS, INBOX_KINDS, INBOX_ROW_KEYS, countInboxViews, listInbox } = await import("./inboxApi");
type InboxFilter = import("./inboxApi").InboxFilter;

beforeEach(() => rpc.mockReset());

// A whole row, as the database sends it (inbox_row): every column, null where there is nothing.
const row = {
  id: "c:m1", kind: "contact", thread_id: "v1", direction: "received", is_new: true, is_automatic: false, from_address: "lucia@reyes.example",
  from_name: "Lucia Reyes", subject: "Re: hello", first_line: "Thanks, see you Tuesday.", at: "2026-11-10T10:00:00+00:00", account_id: "a1",
  account_name: "Reyes Bakery", contact_id: "k1", contact_name: "Lucia Reyes", lead_id: null, lead_name: null, peo_name: null, session_id: null,
  owner: "u1", owner_name: "Dana",
};

describe("listInbox", () => {
  // Catches: a call that drops the firm, sends the search untrimmed, or names an argument the database does not have.
  it("sends the firm, filters, page, search and time zone, and reads the page", async () => {
    rpc.mockResolvedValue({ data: { rows: [row], total: 51, page: 2, page_size: 50 }, error: null });
    const filters: InboxFilter[] = [{ field: "is_new", op: "is", value: true }, { field: "owner", op: "me" }];
    const page = await listInbox({ firmId: "f1", filters, page: 2, search: "  reyes ", timeZone: "America/Chicago" });
    expect(rpc).toHaveBeenCalledWith("inbox_list", {
      p_firm_id: "f1", p_filters: filters, p_sort: null, p_direction: "desc", p_page: 2, p_search: "reyes", p_time_zone: "America/Chicago",
    });
    expect(page).toEqual({ rows: [row], total: 51, page: 2, pageSize: 50 });
  });
});

describe("countInboxViews", () => {
  // Catches: one call per tab, an answer out of order, or a count the database sends as text left unread.
  it("asks for every view's count in one call and answers in the order asked", async () => {
    rpc.mockResolvedValue({ data: [{ view_name: "new", total: 3 }, { view_name: "sent", total: "2" }], error: null });
    const views = [{ name: "new", filters: [{ field: "is_new", op: "is", value: true }] as InboxFilter[] }, { name: "sent", filters: [] }];
    expect(await countInboxViews("f1", views, { search: " a ", timeZone: "UTC" })).toEqual([{ name: "new", total: 3 }, { name: "sent", total: 2 }]);
    expect(rpc).toHaveBeenCalledWith("inbox_view_counts", { p_firm_id: "f1", p_views: views, p_search: "a", p_time_zone: "UTC" });
  });
});

// The database refuses a field it doesn't list, so the browser's lists must be the database's (sync blocks in the migration).
describe("the inbox's fields agree with the database", () => {
  const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"));
  const block = (name: string) => {
    const re = new RegExp(`--\\s*sync:begin ${name}\\s*\\n([\\s\\S]*?)--\\s*sync:end ${name}\\b`);
    const m = migrations.filter((x) => re.test(x)).map((x) => x.match(re)!).at(-1);
    expect(m, `sync block ${name}`).toBeDefined();
    return m![1];
  };
  const words = (name: string) => [...block(name).matchAll(/'([^']+)'/g)].map((m) => m[1]);

  // Catches: a filter the page offers that the database refuses (or one it has that no view can use), and none on the body (never searched, CRM-E1.4).
  it("names the same fields with the same kinds, the same kinds and directions, and none on the body", () => {
    const server = Object.fromEntries([...block("inbox_fields").matchAll(/WHEN '(\w+)' THEN '(\w+)'/g)].map((m) => [m[1], m[2]]));
    expect(server).toEqual(INBOX_FIELDS);
    expect(Object.keys(INBOX_FIELDS)).not.toContain("body_text");
    expect([...INBOX_KINDS]).toEqual(words("inbox_kinds"));
    expect([...INBOX_DIRECTIONS]).toEqual(words("inbox_directions"));
  });

  // Catches: a column the database adds or renames that the page would read as missing.
  it("has a row of the same columns as the database's, in its order, and the test's row is that row", () => {
    const sql = readFileSync("supabase/migrations/20261122150000_inbox.sql", "utf8");
    const body = sql.match(/CREATE TYPE public\.inbox_row AS \(([\s\S]*?)\n\);/);
    expect(body).not.toBeNull();
    const created = body![1].split("\n").map((l) => l.trim().match(/^(\w+) /)?.[1]).filter((c): c is string => c !== undefined);
    expect([...INBOX_ROW_KEYS]).toEqual(created);
    expect(Object.keys(row)).toEqual(created);
  });
});
