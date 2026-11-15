import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { createLead } = await import("./leadCreateApi");
const { AccountError } = await import("./accountPageApi");
type NewLead = import("./leadCreateApi").NewLead;

// What create_lead answers (20261121100000_create_lead.sql, crm_lead_fields).
const made = {
  id: "l9", version: 1, owner_id: "u2", name: "Lucia Reyes", title: "Owner", business: "Reyes Bakery", email: "lucia@reyes.example", phone: null, city: null,
  state: "OR", employees: 23, current_provider: "Gusto", note: null, source: "added_by_hand", status: "new", not_fit_reason: null,
  created_at: "2026-11-15T10:00:00+00:00", updated_at: "2026-11-15T10:00:00+00:00",
};

const input: NewLead = {
  name: "Lucia Reyes", title: "Owner", business: "Reyes Bakery", email: "lucia@reyes.example", phone: "", city: "", state: "OR", employees: 23,
  currentProvider: "Gusto", note: "", ownerId: "u2",
};

beforeEach(() => rpc.mockReset());

describe("createLead", () => {
  // Catches: a field sent under the wrong name, or the firm not sent (the database would act for another firm).
  it("sends every field with the firm and the owner chosen, and answers the made lead", async () => {
    rpc.mockResolvedValue({ data: made, error: null });
    const lead = await createLead("f1", input);
    expect(rpc).toHaveBeenCalledWith("create_lead", {
      p_name: "Lucia Reyes", p_title: "Owner", p_business: "Reyes Bakery", p_email: "lucia@reyes.example", p_phone: "", p_city: "", p_state: "OR",
      p_employees: 23, p_current_provider: "Gusto", p_note: "", p_owner_id: "u2", p_firm_id: "f1",
    });
    expect(lead).toEqual({ id: "l9", version: 1, name: "Lucia Reyes", status: "new", source: "added_by_hand", ownerId: "u2" });
  });

  // Catches: the database's words lost, so the person is told only that something failed.
  it("keeps the database's words for a field it refuses, and says a refused owner as not allowed", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Enter an email address like name@example.com." } });
    await expect(createLead("f1", input)).rejects.toMatchObject({ kind: "invalid", message: "Enter an email address like name@example.com." });
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "You can make a lead only for yourself and, as a lead, for people on your teams." } });
    await expect(createLead("f1", input)).rejects.toMatchObject({ kind: "notAllowed" });
    rpc.mockResolvedValue({ data: null, error: { code: "PT423", message: "Nevermore support can look, not change" } });
    await expect(createLead("f1", input)).rejects.toMatchObject({ kind: "readOnly" });
  });

  // Catches: an answer of another shape taken as a lead.
  it("fails when the answer is not a lead", async () => {
    rpc.mockResolvedValue({ data: { id: "l9" }, error: null });
    const e = await createLead("f1", input).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(AccountError);
    expect((e as InstanceType<typeof AccountError>).kind).toBe("failed");
  });
});
