import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { LEAD_FIELDS, LEAD_NOT_FIT_REASONS, LEAD_ROW_KEYS, LEAD_SOURCES, LEAD_STATUSES, countLeadViews, listLeads } = await import("./leadsApi");
type LeadFilter = import("./leadsApi").LeadFilter;

beforeEach(() => rpc.mockReset());

// A whole row, as the database sends it (leads_row): every column, null where there is nothing.
const row = {
  id: "l1", name: "Lucia Reyes", title: "Owner", business: "Reyes Bakery", email: "lucia@reyes.example", phone: null, city: "Portland", state: "OR",
  employees: 23, current_provider: null, source: "added_by_hand", status: "working", not_fit_reason: null, created_at: "2026-11-01T00:00:00+00:00",
  owner: "u1", owner_name: "Dana Reyes", last_activity_at: "2026-11-10T00:00:00+00:00", labels: ["Hot"],
};

describe("listLeads", () => {
  // Catches: a call that drops the firm, sends the search untrimmed, or names an argument the database does not have.
  it("sends the firm, filters, sort, page, search and time zone, and reads the page", async () => {
    rpc.mockResolvedValue({ data: { rows: [row], total: 51, page: 2, page_size: 50 }, error: null });
    const filters: LeadFilter[] = [{ field: "status", op: "any_of", value: ["new", "working"] }, { field: "owner", op: "me" }];
    const page = await listLeads({ firmId: "f1", filters, sort: { field: "business", direction: "desc" }, page: 2, search: "  reyes ", timeZone: "America/Chicago" });
    expect(rpc).toHaveBeenCalledWith("leads_list", {
      p_firm_id: "f1", p_filters: filters, p_sort: "business", p_direction: "desc", p_page: 2, p_search: "reyes", p_time_zone: "America/Chicago",
    });
    expect(page).toEqual({ rows: [row], total: 51, page: 2, pageSize: 50 });
  });

  // Catches: an answer of another shape shown as "no leads".
  it("fails, plainly, for an answer that is not a page of leads", async () => {
    rpc.mockResolvedValue({ data: { rows: [{ ...row, status: "qualified" }], total: 1, page: 1, page_size: 50 }, error: null });
    await expect(listLeads({ firmId: "f1" })).rejects.toThrow("Couldn't load leads.");
  });

  // Catches: the database's reason for refusing a filter dropped.
  it("passes on a refusal in words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "no" } });
    await expect(listLeads({ firmId: "f1" })).rejects.toThrow("You don't have access to this firm's records.");
  });
});

describe("countLeadViews", () => {
  it("asks for every view's count in one call and answers in the order asked", async () => {
    rpc.mockResolvedValue({ data: [{ view_name: "Open", total: 3 }, { view_name: "New", total: "2" }], error: null });
    const views = [{ name: "Open", filters: [] }, { name: "New", filters: [{ field: "status", op: "any_of", value: ["new"] }] as LeadFilter[] }];
    expect(await countLeadViews("f1", views, { search: " a ", timeZone: "UTC" })).toEqual([{ name: "Open", total: 3 }, { name: "New", total: 2 }]);
    expect(rpc).toHaveBeenCalledWith("leads_view_counts", { p_firm_id: "f1", p_views: views, p_search: "a", p_time_zone: "UTC" });
  });
});

// The database refuses a field it doesn't list, so the browser's lists must be the database's (sync blocks in the migration).
describe("the leads table's fields agree with the database", () => {
  const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"));
  const block = (name: string) => {
    const re = new RegExp(`--\\s*sync:begin ${name}\\s*\\n([\\s\\S]*?)--\\s*sync:end ${name}\\b`);
    const m = migrations.filter((x) => re.test(x)).map((x) => x.match(re)!).at(-1);
    expect(m, `sync block ${name}`).toBeDefined();
    return m![1];
  };
  const words = (name: string) => [...block(name).matchAll(/'([^']+)'/g)].map((m) => m[1]);

  it("names the same fields with the same kinds, and none for email or phone (they have no sort)", () => {
    const server = Object.fromEntries([...block("leads_fields").matchAll(/WHEN '(\w+)' THEN '(\w+)'/g)].map((m) => [m[1], m[2]]));
    expect(server).toEqual(LEAD_FIELDS);
    expect(Object.keys(LEAD_FIELDS)).not.toContain("email");
  });

  it("lists the same sources, statuses and reasons, in the same order", () => {
    expect([...LEAD_SOURCES]).toEqual(words("leads_sources"));
    expect([...LEAD_STATUSES]).toEqual(words("leads_statuses"));
    expect([...LEAD_NOT_FIT_REASONS]).toEqual(words("leads_not_fit_reasons"));
  });

  it("has a row of the same columns as the database's, in its order, and the test's row is that row", () => {
    const sql = readFileSync("supabase/migrations/20261121110500_leads_table_query.sql", "utf8");
    const body = sql.match(/CREATE TYPE public\.leads_row AS \(([\s\S]*?)\n\);/);
    expect(body).not.toBeNull();
    // The columns the type was made with, then each one a later migration added to it, in order.
    const added = migrations.flatMap((m) => [...m.matchAll(/ALTER TYPE public\.leads_row ADD ATTRIBUTE (\w+) /g)].map((x) => x[1]));
    const created = [...body![1].split("\n").map((l) => l.trim().match(/^(\w+) /)?.[1]).filter((c): c is string => c !== undefined), ...added];
    expect([...LEAD_ROW_KEYS]).toEqual(created);
    expect(Object.keys(row)).toEqual(created);
  });
});
