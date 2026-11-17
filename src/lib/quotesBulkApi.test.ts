import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { applyQuotesBulk } = await import("./quotesBulkApi");
const { BulkChangeError } = await import("./bulkChangeApi");

beforeEach(() => rpc.mockReset());

const answer = { action: "owner", selected: 3, requested: 4, unavailable: 1, changed: 2, unchanged: 1, skipped: [{ key: "q9", name: "Kim Dental", code: "level", reason: "Only the account's owner can change it." }] };

describe("applyQuotesBulk", () => {
  // Catches: the owner sent under another name than the database reads, or the rows chosen by keys sent as filters (the database refuses both at once).
  it("changes the owner of the quotes named by their keys and reads what was done", async () => {
    rpc.mockResolvedValue({ data: answer, error: null });
    const done = await applyQuotesBulk("f1", { action: "owner", ownerId: "u2" }, { ids: ["q1", "o2"] });
    expect(rpc).toHaveBeenCalledWith("bulk_quotes_change", { p_firm_id: "f1", p_action: "owner", p_params: { owner_id: "u2" }, p_filters: null, p_ids: ["q1", "o2"] });
    expect(done).toEqual({ selected: 3, requested: 4, unavailable: 1, changed: 2, unchanged: 1, skipped: [{ key: "q9", name: "Kim Dental", code: "level", reason: "Only the account's owner can change it." }] });
  });

  // Catches: "all that match" sent as keys, or a close that drops its reason.
  it("closes the quotes the table's own filters match, with one reason", async () => {
    rpc.mockResolvedValue({ data: { ...answer, action: "close" }, error: null });
    const filters = { filters: [{ field: "status", op: "any_of", value: ["sent"] }], time_zone: "UTC" };
    await applyQuotesBulk("f1", { action: "close", reason: "peo_not_a_fit" }, { filters });
    expect(rpc).toHaveBeenCalledWith("bulk_quotes_change", { p_firm_id: "f1", p_action: "close", p_params: { reason: "peo_not_a_fit" }, p_filters: filters, p_ids: null });
  });

  // Catches: a refusal in words turned into a generic failure, or an answer of another shape taken as done.
  it("passes on a refusal in its kind and refuses an answer it cannot read", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT413", message: "That is 1,200 quotes. A bulk change takes at most 1,000." } });
    await expect(applyQuotesBulk("f1", { action: "close", reason: "other" }, { ids: ["q1"] })).rejects.toMatchObject({ kind: "tooMany" });
    rpc.mockResolvedValue({ data: { changed: "two" }, error: null });
    await expect(applyQuotesBulk("f1", { action: "close", reason: "other" }, { ids: ["q1"] })).rejects.toBeInstanceOf(BulkChangeError);
  });
});
