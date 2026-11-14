import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PIPELINE_STATUSES } from "@/data/advisor";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { countQueueViews, listQueue, QUEUE_FIELDS, QUEUE_LIST_PAGE_SIZE } = await import("./queueApi");
const { AdvisorApiError } = await import("./advisorApi");
const { FILTER_DAYS_MAX, FILTER_LIST_MAX, FILTER_TEXT_MAX, MAX_TABLE_PAGE, TABLE_FILTER_LIMIT } = await import("@/components/workspace/table/columns");
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

  // Catches: the address codec letting through (or cutting short) what the database takes: its limits are the migration's figures.
  it("reads the address by the database's own limits", () => {
    const firstNumber = (re: RegExp) => Number(sql.match(re)?.[1]);
    expect(MAX_TABLE_PAGE).toBe(firstNumber(/A page number is 1 to (\d+)/));
    expect(TABLE_FILTER_LIMIT).toBe(firstNumber(/A table takes at most (\d+) filters/));
    expect(FILTER_TEXT_MAX).toBe(firstNumber(/takes at most (\d+) characters/));
    expect(FILTER_TEXT_MAX).toBe(firstNumber(/takes values of 1 to (\d+) characters/));
    expect(FILTER_LIST_MAX).toBe(firstNumber(/needs 1 to (\d+) values/));
    expect(FILTER_DAYS_MAX).toBe(firstNumber(/whole number of days, 0 to (\d+)/));
  });

  it("offers the pipeline's stages as the stage filter's values, in order", () => {
    expect([...block("queue_pipeline_choices").matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...PIPELINE_STATUSES]);
  });
});
