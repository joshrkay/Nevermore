import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { requestContact } = await import("./contactRequestApi");

const input = { address: "acme-brokers", name: "Pat Visitor", email: "pat@visitor.test", phone: "(503) 555-0142", business: "Visitor Co", message: "Please call me." };

beforeEach(() => {
  rpc.mockReset();
});

describe("requestContact", () => {
  // Break caught: the form sends the wrong parameter names, or sends a firm from the browser instead of the address the visitor is at (D-101: the firm is the server's to find).
  it("asks the database with the firm's address and the visitor's words, and answers that it was taken", async () => {
    rpc.mockResolvedValue({ data: "taken", error: null });
    expect(await requestContact(input)).toBe("taken");
    expect(rpc).toHaveBeenCalledWith("request_contact", {
      p_address: "acme-brokers", p_name: "Pat Visitor", p_email: "pat@visitor.test", p_phone: "(503) 555-0142", p_business: "Visitor Co", p_message: "Please call me.",
    });
  });

  // Break caught (found by mutation): a request the link had no room for is read as taken, so the visitor is thanked for a request nobody will see.
  it("answers busy when the database says the link has had its share for the hour", async () => {
    rpc.mockResolvedValue({ data: "busy", error: null });
    expect(await requestContact(input)).toBe("busy");
  });

  // Break caught: a visitor who left out their email sees "Couldn't send" and retypes the same thing, or a raw database error.
  it("says what is wrong in the database's own words when it refuses a field", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Enter an email address or a phone number so the firm can reach you." } });
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "invalid", message: "Enter an email address or a phone number so the firm can reach you." });
  });

  // Break caught: a visitor is shown a database or network error ("relation ... does not exist", "TypeError: Failed to fetch").
  it("shows nothing of an unexpected failure but a plain sentence, and keeps the words of the two refusals written for visitors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42P01", message: 'relation "leads" does not exist' } });
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "failed", message: "Couldn't send your request. Try again." });
    rpc.mockResolvedValue({ data: null, error: { code: "PT423", message: "This firm is not taking requests right now." } });
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "failed", message: "This firm is not taking requests right now." });
  });
});
