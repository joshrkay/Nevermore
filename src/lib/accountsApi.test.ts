import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { ACCOUNT_FIELDS, ACCOUNT_LIST_PAGE_SIZE, ACCOUNT_OPEN_STAGES, ACCOUNT_ROW_KEYS, ACCOUNT_SOURCES, ACCOUNT_STATUSES, countAccountViews, listAccounts, listFirmMembers } = await import("./accountsApi");
const { AdvisorApiError } = await import("./advisorApi");
const { FILTER_LIST_MAX, MAX_TABLE_PAGE, TABLE_FILTER_LIMIT, VIEWS_PER_COUNT_CALL } = await import("@/components/workspace/table/columns");
type AccountFilter = import("./accountsApi").AccountFilter;

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e as InstanceType<typeof AdvisorApiError>;
  }
  throw new Error("expected a failure");
};

beforeEach(() => rpc.mockReset());

// A whole row, as the database sends it: every column, null where there is nothing.
const row = {
  id: "a1", name: "Alpha Co", trade_name: null, website: "https://alpha.example", city: "Portland", state: "OR", industry: null, employees: 50,
  states_of_operation: ["OR", "WA"], current_provider: null, source: "added_by_hand", status: "prospect", archived: false, archived_at: null,
  created_at: "2026-10-01T00:00:00+00:00", owner: "u1", owner_name: "Ann Agent", main_contact_id: "c1", main_contact_name: "Ann Alpha",
  main_contact_email: "ann@alpha.example", main_contact_phone: null, opportunity_id: "o1", opportunity_name: "Alpha search", opportunity_stage: "in_market",
  target_start: "2027-02-01", open_opportunities: 2, quote_requests_sent: 2, quotes_received: 1, waiting_on_peo: true,
  earliest_quote_expires_on: "2026-12-31", last_activity_at: "2026-10-20T00:00:00+00:00", labels: ["Hot lead"], renewal_date: "2026-12-15",
};

describe("listAccounts", () => {
  // Catches: a call that drops the firm (a person of two firms is refused), sends the search untrimmed, or names an argument the database does not have.
  it("sends the firm, filters, sort, page, search and time zone as they are, and reads the page", async () => {
    rpc.mockResolvedValue({ data: { rows: [row], total: 75, page: 2, page_size: 50 }, error: null });
    const filters: AccountFilter[] = [
      { field: "owner", op: "any_of", value: ["u1", "u2"] },
      { field: "employees", op: "between", value: [10, 50] },
      { field: "archived", op: "is", value: false },
    ];
    const page = await listAccounts({ firmId: "f1", filters, sort: { field: "name", direction: "desc" }, page: 2, search: "  acme ", timeZone: "America/New_York" });
    expect(rpc).toHaveBeenCalledWith("accounts_list", {
      p_firm_id: "f1",
      p_filters: filters,
      p_sort: "name",
      p_direction: "desc",
      p_page: 2,
      p_search: "acme",
      p_time_zone: "America/New_York",
    });
    expect(page).toEqual({ rows: [row], total: 75, page: 2, pageSize: 50 });
  });

  // Catches: a person filter that is made into something the database does not read ("me" with a value).
  it("sends me and my team with no value", async () => {
    rpc.mockResolvedValue({ data: { rows: [], total: 0, page: 1, page_size: 50 }, error: null });
    await listAccounts({ firmId: "f1", filters: [{ field: "owner", op: "me" }, { field: "owner", op: "my_team" }] });
    expect(rpc.mock.calls[0][1].p_filters).toEqual([{ field: "owner", op: "me" }, { field: "owner", op: "my_team" }]);
  });

  // Catches: a default sort made up here (the database's own order is last activity, newest first) or a missing time zone for a date filter.
  it("asks for the first page in the table's own order, in the browser's time zone, when it is asked nothing", async () => {
    rpc.mockResolvedValue({ data: { rows: [], total: 0, page: 1, page_size: 50 }, error: null });
    const page = await listAccounts({ firmId: "f1" });
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe("accounts_list");
    expect(args).toMatchObject({ p_firm_id: "f1", p_filters: [], p_sort: null, p_direction: "asc", p_page: 1, p_search: null });
    expect(args.p_time_zone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(page).toEqual({ rows: [], total: 0, page: 1, pageSize: ACCOUNT_LIST_PAGE_SIZE });
  });

  // Catches: no firm named sent as undefined (the database reads null as "the firm at this address").
  it("names no firm as null, so the database takes the firm at the address", async () => {
    rpc.mockResolvedValue({ data: { rows: [], total: 0, page: 1, page_size: 50 }, error: null });
    await listAccounts({});
    expect(rpc.mock.calls[0][1].p_firm_id).toBeNull();
  });

  it("never asks for a page before the first", async () => {
    rpc.mockResolvedValue({ data: { rows: [], total: 0, page: 1, page_size: 50 }, error: null });
    await listAccounts({ firmId: "f1", page: -3 });
    expect(rpc.mock.calls[0][1].p_page).toBe(1);
  });

  // Catches: a refused filter swallowed, so the page shows the whole table under a chip that filtered nothing.
  it("passes on the database's reason for refusing a filter, never dropping it", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: 'The accounts table has no field "firm_id" to filter by' } });
    const err = await caught(() => listAccounts({ firmId: "f1", filters: [{ field: "name", op: "is_empty" }] }));
    expect(err).toBeInstanceOf(AdvisorApiError);
    expect(err.message).toBe('The accounts table has no field "firm_id" to filter by');
    expect(err.forbidden).toBe(false);
  });

  it("calls a refusal of access forbidden, in words", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not a member of that firm" } });
    const err = await caught(() => listAccounts({ firmId: "f1" }));
    expect(err.forbidden).toBe(true);
    expect(err.message).toBe("You don't have access to this firm's records.");
  });

  it("calls an expired token an ended session", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST301", message: "JWT expired" } });
    expect((await caught(() => listAccounts({ firmId: "f1" }))).unauthenticated).toBe(true);
  });

  // Catches: an answer that is not the agreed shape read as "no accounts": a page that failed shown as an empty table. Each goes down the failed path
  // (a plain message and a retry), as a refusal that is not the person's own does.
  it.each([
    ["nothing", null],
    ["a list in place of the page", []],
    ["rows that are not a list", { rows: {}, total: 75, page: 1, page_size: 50 }],
    ["a total in text", { rows: [row], total: "75", page: 1, page_size: 50 }],
    ["no total", { rows: [row], page: 1, page_size: 50 }],
    ["no page", { rows: [row], total: 1, page_size: 50 }],
    ["no page size", { rows: [row], total: 1, page: 1 }],
    ["a total below 0", { rows: [row], total: -1, page: 1, page_size: 50 }],
    ["a row with a column missing", { rows: [{ ...row, owner_name: undefined }], total: 1, page: 1, page_size: 50 }],
    ["a row whose name is not text", { rows: [{ ...row, name: 7 }], total: 1, page: 1, page_size: 50 }],
    ["a row with a status nobody knows", { rows: [{ ...row, status: "lapsed" }], total: 1, page: 1, page_size: 50 }],
    ["a row whose open opportunities are text", { rows: [{ ...row, open_opportunities: "2" }], total: 1, page: 1, page_size: 50 }],
    ["a row whose states are not a list", { rows: [{ ...row, states_of_operation: "OR" }], total: 1, page: 1, page_size: 50 }],
    ["a second row that is wrong", { rows: [row, { ...row, id: 5 }], total: 2, page: 1, page_size: 50 }],
  ])("fails, plainly, for an answer with %s", async (_what, data) => {
    rpc.mockResolvedValue({ data, error: null });
    const err = await caught(() => listAccounts({ firmId: "f1" }));
    expect(err).toBeInstanceOf(AdvisorApiError);
    expect(err.message).toBe("Couldn't load accounts.");
    expect(err.forbidden).toBe(false);
    expect(err.unauthenticated).toBe(false);
  });

  // Catches: a column the type lists that the check lets go missing (a page that draws "undefined"), or one it holds that the type does not list.
  it("needs every column of the row, and the test's row is that row", async () => {
    expect(Object.keys(row)).toEqual([...ACCOUNT_ROW_KEYS]);
    for (const key of ACCOUNT_ROW_KEYS) {
      const { [key]: _dropped, ...without } = row as Record<string, unknown>;
      rpc.mockResolvedValue({ data: { rows: [without], total: 1, page: 1, page_size: 50 }, error: null });
      expect((await caught(() => listAccounts({ firmId: "f1" }))).message, `without ${key}`).toBe("Couldn't load accounts.");
    }
  });

  it("takes a row whose every nothing is null, and an empty page", async () => {
    rpc.mockResolvedValue({ data: { rows: [{ ...row, owner: null, owner_name: null, opportunity_stage: null, trade_name: null }], total: 1, page: 1, page_size: 50 }, error: null });
    expect((await listAccounts({ firmId: "f1" })).rows).toHaveLength(1);
    rpc.mockResolvedValue({ data: { rows: [], total: 0, page: 3, page_size: 50 }, error: null });
    expect(await listAccounts({ firmId: "f1", page: 3 })).toEqual({ rows: [], total: 0, page: 3, pageSize: 50 });
  });
});

describe("countAccountViews", () => {
  it("asks for every view's count in one call and answers in the order asked", async () => {
    rpc.mockResolvedValue({ data: [{ view_name: "All accounts", total: 58 }, { view_name: "Clients", total: "3" }], error: null });
    const counts = await countAccountViews(
      "f1",
      [{ name: "All accounts", filters: [] }, { name: "Clients", filters: [{ field: "status", op: "any_of", value: ["client"] }] }],
      { search: " co ", timeZone: "UTC" },
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("accounts_view_counts", {
      p_firm_id: "f1",
      p_views: [{ name: "All accounts", filters: [] }, { name: "Clients", filters: [{ field: "status", op: "any_of", value: ["client"] }] }],
      p_search: "co",
      p_time_zone: "UTC",
    });
    // A count the database sends as text (a big number) is a number here.
    expect(counts).toEqual([{ name: "All accounts", total: 58 }, { name: "Clients", total: 3 }]);
  });

  // Catches: counts that are not the agreed shape read as zero everywhere (every tab "0").
  it.each([
    ["nothing", null],
    ["not a list", { view_name: "A", total: 1 }],
    ["a view with no name", [{ total: 1 }]],
    ["a total that is not a number", [{ view_name: "A", total: "many" }]],
    ["a negative total", [{ view_name: "A", total: -2 }]],
  ])("fails, plainly, for an answer with %s", async (_what, data) => {
    rpc.mockResolvedValue({ data, error: null });
    const err = await caught(() => countAccountViews("f1", [{ name: "A", filters: [] }]));
    expect(err).toBeInstanceOf(AdvisorApiError);
    expect(err.message).toBe("Couldn't count the views.");
  });

  it("passes on a refusal", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: 'Two views are named "A"' } });
    expect((await caught(() => countAccountViews("f1", [{ name: "A", filters: [] }]))).message).toBe('Two views are named "A"');
  });
});

describe("listFirmMembers", () => {
  // Catches: a person shown by id (the filter needs the id, the chip the name), or the firm left out.
  it("gives each current member by the id a person filter takes and their name", async () => {
    rpc.mockResolvedValue({ data: [{ user_id: "u1", name: "Ann Agent" }, { user_id: "u2", name: "lena@example.com" }], error: null });
    expect(await listFirmMembers("f1")).toEqual([{ value: "u1", label: "Ann Agent" }, { value: "u2", label: "lena@example.com" }]);
    expect(rpc).toHaveBeenCalledWith("firm_member_choices", { p_firm_id: "f1" });
  });

  // Catches: people the filter cannot name (a missing name or id) offered as choices.
  it.each([
    ["nothing", null],
    ["not a list", { user_id: "u1", name: "Ann" }],
    ["a member with no name", [{ user_id: "u1", name: null }]],
    ["a member with no id", [{ name: "Ann" }]],
    ["a blank name", [{ user_id: "u1", name: "  " }]],
  ])("fails, plainly, for an answer with %s", async (_what, data) => {
    rpc.mockResolvedValue({ data, error: null });
    const err = await caught(() => listFirmMembers("f1"));
    expect(err).toBeInstanceOf(AdvisorApiError);
    expect(err.message).toBe("Couldn't load the firm's people.");
  });

  it("passes on a refusal", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not a member of that firm" } });
    expect((await caught(() => listFirmMembers("f1"))).forbidden).toBe(true);
  });
});

// The database refuses a field it doesn't list, so the browser's list must be the database's (sync blocks in the migration).
describe("the accounts table's fields agree with the database", () => {
  const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"));
  const sql = readFileSync("supabase/migrations/20261119130000_accounts_table_query.sql", "utf8");
  // The newest migration that holds the block: a later migration that restates a function (the labels' field, 20261119210000) is the database's list now.
  const block = (name: string) => {
    const re = new RegExp(`--\\s*sync:begin ${name}\\s*\\n([\\s\\S]*?)--\\s*sync:end ${name}\\b`);
    const m = migrations.filter((x) => re.test(x)).map((x) => x.match(re)!).at(-1);
    expect(m, `sync block ${name}`).toBeDefined();
    return m![1];
  };

  it("names the same fields with the same kinds", () => {
    const server = Object.fromEntries([...block("accounts_fields").matchAll(/WHEN '(\w+)' THEN '(\w+)'/g)].map((m) => [m[1], m[2]]));
    expect(server).toEqual(ACCOUNT_FIELDS);
  });

  // The main contact is shown and never filtered or sorted (CRM-A1.1), so a field of it would be one the database refuses. The renewal's two fields are
  // placements and renewals' (CRM-A2.4a).
  it("has no field for the main contact, and has the renewal's two", () => {
    expect(Object.keys(ACCOUNT_FIELDS).filter((f) => /contact/.test(f))).toEqual([]);
    expect(ACCOUNT_FIELDS.renewal_date).toBe("date");
    expect(ACCOUNT_FIELDS.renewing_in_120_days).toBe("yes_no");
  });

  it("lists the same sources, statuses and open stages, in the same order", () => {
    const words = (name: string) => [...block(name).matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect([...ACCOUNT_SOURCES]).toEqual(words("accounts_sources"));
    expect([...ACCOUNT_STATUSES]).toEqual(words("accounts_statuses"));
    expect([...ACCOUNT_OPEN_STAGES]).toEqual(words("accounts_open_stages"));
  });

  // Catches: a column the page reads that the database's row does not have, or one the database sends that the page does not know.
  it("has a row of the same columns as the database's, in its order", () => {
    const body = sql.match(/CREATE TYPE public\.accounts_row AS \(([\s\S]*?)\n\);/);
    expect(body).not.toBeNull();
    const created = body![1].split("\n").map((l) => l.trim().match(/^(\w+) /)?.[1]).filter((c): c is string => c !== undefined);
    const added = migrations.flatMap((x) => [...x.matchAll(/ALTER TYPE public\.accounts_row ADD ATTRIBUTE (\w+)/g)].map((m) => m[1]));
    expect([...ACCOUNT_ROW_KEYS]).toEqual([...created, ...added]);
  });

  // Every filterable field is a column of the row, so a chip is always for something the page has. One is a view's rule, not a column: the built-in view
  // "Renewing in 120 days" (D-450), which the database works out from the Renewal date.
  it("names no field that is not a column of the row (the owner's column is `owner`)", () => {
    expect(Object.keys(ACCOUNT_FIELDS).filter((f) => !(ACCOUNT_ROW_KEYS as readonly string[]).includes(f))).toEqual(["renewing_in_120_days"]);
  });

  // Catches: the address codec letting through (or cutting short) what the database takes. Each limit is read from the check in the migration that holds it.
  describe("reads the address by the database's own limits", () => {
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    const latestBody = (fn: string) => {
      const holding = files
        .map((name) => ({ name, sql: readFileSync(`supabase/migrations/${name}`, "utf8") }))
        .flatMap((f) => [...f.sql.matchAll(new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\b`, "g"))].map((m) => ({ name: f.name, body: f.sql.slice(m.index!).split(/\nCREATE\s/)[0] })));
      expect(holding.length, `a migration defines ${fn}`).toBeGreaterThan(0);
      return holding.at(-1)!;
    };
    // [what, ours, the function that holds the check, the check, its message, where in the function to start reading (the person branch repeats the list checks)]
    const cases: [string, number, string, RegExp, RegExp, string?][] = [
      ["a page", MAX_TABLE_PAGE, "accounts_list", /pg < 1 OR pg > (\d+)/, /A page number is 1 to (\d+)/],
      ["filters in all", TABLE_FILTER_LIMIT, "accounts_filters_checked", /jsonb_array_length\(p_filters\) > (\d+)/, /A table takes at most (\d+) filters/],
      ["people in a filter", FILTER_LIST_MAX, "workspace_filter_check", /jsonb_array_length\(v\) = 0 OR jsonb_array_length\(v\) > (\d+) THEN/, /needs 1 to (\d+) people/, "p_kind = 'person'"],
      ["views in one count call", VIEWS_PER_COUNT_CALL, "accounts_view_counts", /jsonb_array_length\(p_views\) NOT BETWEEN 1 AND (\d+)/, /Views are a list of 1 to (\d+)/],
    ];
    it.each(cases)("%s", (_name, ours, fn, check, message, from) => {
      const { body } = latestBody(fn);
      const read = from ? body.slice(body.indexOf(from)) : body;
      expect(read.match(check), `${fn} holds ${check}`).not.toBeNull();
      expect(Number(read.match(check)![1])).toBe(ours);
      expect(Number(read.match(message)?.[1]), `${fn}'s message agrees with its check`).toBe(ours);
    });
  });
});
