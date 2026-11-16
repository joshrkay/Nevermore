import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { requestContact, contactRequestAvailable, NOT_AVAILABLE } = await import("./contactRequestApi");

// The form posts to the contact-request function (slice 8.7b, D-1670 to D-1679), which checks the Turnstile token and then asks the database; the page no longer asks the database.
const input = { address: "acme-brokers", name: "Pat Visitor", email: "pat@visitor.test", phone: "(503) 555-0142", business: "Visitor Co", message: "Please call me.", token: "turnstile-token" };

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_SUPABASE_URL", "https://p.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key-123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("requestContact", () => {
  // Break caught: the form posts to the database (skipping the captcha), sends the wrong field names, forgets the Turnstile token, or sends a firm from the browser instead of the address the visitor is at (D-101).
  it("posts the visitor's words, the firm's address and the Turnstile token to the contact-request function, and answers that it was taken", async () => {
    fetchMock.mockResolvedValue(answer(200, { answer: "taken" }));
    expect(await requestContact(input)).toBe("taken");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://p.supabase.co/functions/v1/contact-request");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", apikey: "publishable-key" });
    expect(JSON.parse(init.body)).toEqual({
      address: "acme-brokers", name: "Pat Visitor", email: "pat@visitor.test", phone: "(503) 555-0142", business: "Visitor Co", message: "Please call me.", token: "turnstile-token",
    });
  });

  // Break caught (found by mutation): a request the link had no room for is read as taken, so the visitor is thanked for a request nobody will see.
  it("answers busy when the database says the link has had its share for the hour", async () => {
    fetchMock.mockResolvedValue(answer(200, { answer: "busy" }));
    expect(await requestContact(input)).toBe("busy");
  });

  // Break caught: a visitor who left out their email sees "Couldn't send" and retypes the same thing, or a raw database error.
  it("says what is wrong in the database's own words when it refuses a field", async () => {
    fetchMock.mockResolvedValue(answer(422, { error: "Enter an email address or a phone number so the firm can reach you." }));
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "invalid", message: "Enter an email address or a phone number so the firm can reach you." });
  });

  // Break caught: a visitor is shown a server or network error ("relation ... does not exist", "TypeError: Failed to fetch"), or the words of a refused check are lost.
  it("shows nothing of an unexpected failure but a plain sentence, and keeps the words written for visitors", async () => {
    fetchMock.mockResolvedValue(answer(500, { error: 'relation "leads" does not exist' }));
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "failed", message: "Couldn't send your request. Try again." });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "failed", message: "Couldn't send your request. Try again." });
    fetchMock.mockResolvedValue(answer(423, { error: "This firm is not taking requests right now." }));
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "failed", message: "This firm is not taking requests right now." });
    fetchMock.mockResolvedValue(answer(403, { error: "The check didn't pass. Try again." }));
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "failed", message: "The check didn't pass. Try again." });
    fetchMock.mockResolvedValue(answer(503, { error: NOT_AVAILABLE }));
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "failed", message: NOT_AVAILABLE });
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(requestContact(input)).rejects.toMatchObject({ kind: "failed", message: "Couldn't send your request. Try again." });
  });
});

describe("contactRequestAvailable", () => {
  // Break caught: with no Turnstile site key the form opens anyway, and a visitor could only ever be refused by the function after typing everything.
  it("is on only with a Turnstile site key", () => {
    expect(contactRequestAvailable()).toBe(true);
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    expect(contactRequestAvailable()).toBe(false);
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "   ");
    expect(contactRequestAvailable()).toBe(false);
  });

  it("says in plain words that asking to be contacted isn't available", () => {
    expect(NOT_AVAILABLE).toBe("Asking to be contacted isn't available right now");
  });
});
