import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { checkAccountDuplicates, checkContactDuplicates } = await import("./duplicateApi");

beforeEach(() => rpc.mockReset());

const seenAccount = { kind: "account", visible: true, id: "a1", name: "Harbor Dental LLC", archived: false, reasons: ["name", "website"], owner: { id: "u1", name: "Dana Reyes" } };
const mask = { kind: "account", visible: false, ask: { kind: "owner", names: ["Marcus Hale"] } };
const none = { name: "x", website: "", state: "" };

describe("checkAccountDuplicates", () => {
  // Catches: the form sending what is typed to another rule than the database's, or to no firm.
  it("asks the database, in the firm, with the website, name and state as typed", async () => {
    rpc.mockResolvedValue({ data: { matches: [], more: 0 }, error: null });
    await checkAccountDuplicates("f1", { name: "Harbor Dental", website: "harbordental.example", state: "OR" });
    expect(rpc).toHaveBeenCalledWith("duplicate_account_check", { p_firm_id: "f1", p_name: "Harbor Dental", p_website: "harbordental.example", p_state: "OR" });
  });

  // Catches: a seen match losing the id the link needs, or a mask gaining anything of the record.
  it("answers a seen match in full and a masked one as only that it exists and whom to ask", async () => {
    rpc.mockResolvedValue({ data: { matches: [seenAccount, mask], more: 2 }, error: null });
    const found = await checkAccountDuplicates("f1", none);
    expect(found.more).toBe(2);
    expect(found.matches[0]).toEqual(seenAccount);
    expect(found.matches[1]).toEqual(mask);
  });

  // Catches: a mask that carries a record's name or id on to the screen even if the database sent one.
  it("drops anything extra a masked match carries", async () => {
    rpc.mockResolvedValue({ data: { matches: [{ ...mask, id: "a9", name: "Secret Co", reasons: ["website"] }], more: 0 }, error: null });
    const found = await checkAccountDuplicates("f1", none);
    expect(Object.keys(found.matches[0]).sort()).toEqual(["ask", "kind", "visible"]);
  });

  // Catches: a failed or odd answer taken for "no duplicates", so a warning is silently lost.
  it("fails, rather than answering no duplicates, when the database refuses or answers another shape", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "no" } });
    await expect(checkAccountDuplicates("f1", none)).rejects.toThrow();
    rpc.mockResolvedValue({ data: { matches: [{ kind: "account", visible: true }], more: 0 }, error: null });
    await expect(checkAccountDuplicates("f1", none)).rejects.toThrow();
  });
});

describe("checkContactDuplicates", () => {
  it("asks the database, in the firm, with the email as typed, and answers the contact with its account", async () => {
    const contact = { kind: "contact", visible: true, id: "c1", name: "Pat Harbor", archived: false, reasons: ["email"], account: { id: "a1", name: "Harbor Dental LLC" }, owner: null };
    rpc.mockResolvedValue({ data: { matches: [contact], more: 0 }, error: null });
    const found = await checkContactDuplicates("f1", "pat@harbor.example");
    expect(rpc).toHaveBeenCalledWith("duplicate_contact_check", { p_firm_id: "f1", p_email: "pat@harbor.example" });
    expect(found.matches[0]).toEqual(contact);
  });
});
