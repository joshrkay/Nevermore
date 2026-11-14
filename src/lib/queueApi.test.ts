import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PIPELINE_STATUSES } from "@/data/advisor";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { countQueueViews, listQueue, QUEUE_FIELDS, QUEUE_LIST_PAGE_SIZE } = await import("./queueApi");
const { AdvisorApiError } = await import("./advisorApi");
const { FILTER_DAYS_MAX, FILTER_LIST_MAX, FILTER_TEXT_MAX, MAX_TABLE_PAGE, TABLE_FILTER_LIMIT, VIEWS_PER_COUNT_CALL } = await import("@/components/workspace/table/columns");
type QueueFilter = import("./queueApi").QueueFilter;

const caught = async (call: () => Promise<unknown>) => {
  try {
    await call();
  } catch (e) {
    return e as InstanceType<typeof AdvisorApiError>;
  }
  throw new Error("expected a failure");
};

beforeEach(() => rpc.mockReset());

describe("listQueue", () => {
  it("sends the filters, sort, page, search and time zone as they are, and reads the page", async () => {
    const row = { session_id: "s1", company_name: "Acme", has_new_peo_mail: true, waiting_on_peo: false };
    rpc.mockResolvedValue({ data: { rows: [row], total: 75, page: 2, page_size: 50 }, error: null });
    const filters: QueueFilter[] = [
      { field: "has_new_peo_mail", op: "is", value: true },
      { field: "employee_count", op: "between", value: [10, 50] },
    ];
    const page = await listQueue({ filters, sort: { field: "company_name", direction: "desc" }, page: 2, search: "  acme ", timeZone: "America/New_York" });
    expect(rpc).toHaveBeenCalledWith("queue_list_submissions", {
      p_filters: filters,
      p_sort: "company_name",
      p_direction: "desc",
      p_page: 2,
      p_search: "acme",
      p_time_zone: "America/New_York",
    });
    expect(page).toEqual({ rows: [row], total: 75, page: 2, pageSize: 50 });
  });

  it("asks for the first page in the queue's own order with no filters, in the browser's time zone", async () => {
    rpc.mockResolvedValue({ data: { rows: [], total: 0, page: 1, page_size: 50 }, error: null });
    const page = await listQueue();
    const [, args] = rpc.mock.calls[0];
    expect(args).toMatchObject({ p_filters: [], p_sort: null, p_direction: "asc", p_page: 1, p_search: null });
    expect(args.p_time_zone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(page).toEqual({ rows: [], total: 0, page: 1, pageSize: QUEUE_LIST_PAGE_SIZE });
  });

  it("never asks for a page before the first", async () => {
    rpc.mockResolvedValue({ data: { rows: [], total: 0, page: 1, page_size: 50 }, error: null });
    await listQueue({ page: -3 });
    expect(rpc.mock.calls[0][1].p_page).toBe(1);
  });

  it("passes on the database's reason for refusing a filter, never dropping it", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: 'The queue has no field "firm_id" to filter by' } });
    const err = await caught(() => listQueue({ filters: [{ field: "company_name", op: "is_empty" }] }));
    expect(err).toBeInstanceOf(AdvisorApiError);
    expect(err.message).toBe('The queue has no field "firm_id" to filter by');
    expect(err.forbidden).toBe(false);
  });

  it("calls a refusal of access forbidden", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Advisor access required" } });
    const err = await caught(() => listQueue());
    expect(err.forbidden).toBe(true);
    expect(err.message).toBe("You don't have access to this firm's records.");
  });

  it("calls an expired token an ended session", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST301", message: "JWT expired" } });
    expect((await caught(() => listQueue())).unauthenticated).toBe(true);
  });
});

describe("countQueueViews", () => {
  it("asks for every view's count in one call and answers in the order asked", async () => {
    rpc.mockResolvedValue({ data: [{ view_name: "All", total: 58 }, { view_name: "Inbox", total: 1 }], error: null });
    const counts = await countQueueViews(
      [{ name: "All", filters: [] }, { name: "Inbox", filters: [{ field: "has_new_peo_mail", op: "is", value: true }] }],
      { timeZone: "UTC" },
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("queue_view_counts", {
      p_views: [{ name: "All", filters: [] }, { name: "Inbox", filters: [{ field: "has_new_peo_mail", op: "is", value: true }] }],
      p_search: null,
      p_time_zone: "UTC",
    });
    expect(counts).toEqual([{ name: "All", total: 58 }, { name: "Inbox", total: 1 }]);
  });

  it("passes on a refusal", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: 'Two views are named "A"' } });
    expect((await caught(() => countQueueViews([{ name: "A", filters: [] }]))).message).toBe('Two views are named "A"');
  });
});

// The database refuses a field it doesn't list, so the browser's list must be the database's (sync blocks in the migration).
describe("the queue's fields agree with the database", () => {
  const sql = readFileSync("supabase/migrations/20261117100000_queue_query.sql", "utf8");
  const block = (name: string) => {
    const m = sql.match(new RegExp(`--\\s*sync:begin ${name}\\s*\\n([\\s\\S]*?)--\\s*sync:end ${name}\\b`));
    expect(m, `sync block ${name}`).not.toBeNull();
    return m![1];
  };

  it("names the same fields with the same kinds", () => {
    const server = Object.fromEntries([...block("queue_fields").matchAll(/WHEN '(\w+)' THEN '(\w+)'/g)].map((m) => [m[1], m[2]]));
    expect(server).toEqual(QUEUE_FIELDS);
  });

  // Catches: the address codec letting through (or cutting short) what the database takes. Each limit is read from the CHECK itself in the
  // latest migration that holds it (not from the words of its message, which could stay while the check changes), its message must say the
  // same number, and no later migration may have redefined the function that holds the check without it.
  describe("reads the address by the database's own limits", () => {
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().map((name) => ({ name, sql: readFileSync(`supabase/migrations/${name}`, "utf8") }));
    // The text of a function's definition: from its CREATE to the next statement that creates something.
    const bodiesOf = (sql: string, fn: string) =>
      [...sql.matchAll(new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\b`, "g"))].map((m) => {
        const rest = sql.slice(m.index!);
        const next = rest.slice(10).search(/\nCREATE\s/);
        return next === -1 ? rest : rest.slice(0, next + 10);
      });
    const limit = (check: RegExp, message: RegExp, owners: string[], holders = owners, which: "latest" | "first" = "latest"): number => {
      const holding = files
        .map((f) => ({ name: f.name, sql: holders.flatMap((h) => bodiesOf(f.sql, h)).find((b) => check.test(b)) }))
        .filter((f): f is { name: string; sql: string } => f.sql !== undefined);
      expect(holding.length, `a function (${holders}) holds ${check}`).toBeGreaterThan(0);
      const latest = which === "first" ? holding[0] : holding.at(-1)!;
      const number = Number(latest.sql.match(check)![1]);
      expect(Number(latest.sql.match(message)?.[1]), `${latest.name}: the message agrees with the check ${check}`).toBe(number);
      const redefined = files.filter((f) => f.name > latest.name && owners.some((o) => new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${o}\\b`).test(f.sql))).map((f) => f.name);
      expect(redefined, `a later migration redefines ${owners} without ${check}`).toEqual([]);
      return number;
    };
    const cases: [string, number, RegExp, RegExp, string[], string[]?, ("latest" | "first")?][] = [
      ["a page", MAX_TABLE_PAGE, /pg < 1 OR pg > (\d+)/, /A page number is 1 to (\d+)/, ["queue_page_full"], ["queue_list_submissions"]],
      // The first definition of the call lives on, renamed, as queue_page_full (the faster path in 20261117100500 asks it for what it can't answer), and both check the page.
      ["a page, in the full path", MAX_TABLE_PAGE, /pg < 1 OR pg > (\d+)/, /A page number is 1 to (\d+)/, ["queue_page_full"], ["queue_list_submissions"], "first"],
      ["filters in all", TABLE_FILTER_LIMIT, /jsonb_array_length\(p_filters\) > (\d+)/, /A table takes at most (\d+) filters/, ["queue_filters_checked"]],
      ["a text value", FILTER_TEXT_MAX, /char_length\(v #>> '\{\}'\) > (\d+)/, /takes at most (\d+) characters/, ["workspace_filter_check"]],
      ["a list value", FILTER_TEXT_MAX, /char_length\(item #>> '\{\}'\) > (\d+)/, /takes values of 1 to (\d+) characters/, ["workspace_filter_check"]],
      ["values in a list", FILTER_LIST_MAX, /jsonb_array_length\(v\) = 0 OR jsonb_array_length\(v\) > (\d+)/, /needs 1 to (\d+) values/, ["workspace_filter_check"]],
      ["days", FILTER_DAYS_MAX, /NOT BETWEEN 0 AND (\d+)\s*\n?\s*OR/, /whole number of days, 0 to (\d+)/, ["workspace_filter_check"]],
      ["views in one count call", VIEWS_PER_COUNT_CALL, /jsonb_array_length\(p_views\) NOT BETWEEN 1 AND (\d+)/, /Views are a list of 1 to (\d+)/, ["queue_view_counts"]],
    ];
    it.each(cases)("%s", (_name, ours, check, message, owners, holders, which) => {
      expect(ours).toBe(limit(check, message, owners, holders, which));
    });
  });

  it("offers the pipeline's stages as the stage filter's values, in order", () => {
    expect([...block("queue_pipeline_choices").matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...PIPELINE_STATUSES]);
  });
});
