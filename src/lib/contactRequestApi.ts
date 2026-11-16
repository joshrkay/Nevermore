// What the "contact me" form on a firm's public link asks (story CRM-L1.2b, slices 8.7 and 8.7b; supabase/functions/contact-request): one call to the contact-request
// function, which checks the visitor with Cloudflare Turnstile and then makes a lead of the firm the address names. The page no longer asks the database itself: its
// function is the service role's alone (D-1673), so the check cannot be skipped. The firm is the server's to find from the address, never the browser's word (D-101). The
// database decides every rule (the fields, a closing firm, how many an hour); this only puts the answer into the page's shape.

/** What the visitor typed (every text as typed, a blank is nothing) and the token Turnstile's widget gave. */
export interface ContactRequest {
  /** The firm's address, from the host the visitor is at. */
  address: string;
  name: string;
  email: string;
  phone: string;
  business: string;
  message: string;
  /** Turnstile's one-time token for this request. */
  token: string;
}

/** "taken": the firm has it (a repeat of the same email counts as taken). "busy": the link has had its share for this hour, try later. */
export type ContactAnswer = "taken" | "busy";

const FAILED = "Couldn't send your request. Try again.";

/** What the form and the function both say when asking to be contacted is not set up: no site key, or no secret. */
export const NOT_AVAILABLE = "Asking to be contacted isn't available right now";

/** Whether the form can be offered: it needs Turnstile's site key, and is never open without the check. */
export const contactRequestAvailable = (): boolean => Boolean((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim());

/** A refusal in words: `invalid` (the database says what is wrong with a field) or `failed`. */
export class ContactRequestError extends Error {
  constructor(readonly kind: "invalid" | "failed", message: string) {
    super(message);
  }
}

/** The words the function writes for a visitor; any other answer is shown as the plain sentence. */
const VISITOR_WORDS = new Set([NOT_AVAILABLE, "The check didn't pass. Try again.", "Confirm you are not a robot, then try again.", "This firm is not taking requests right now.", "No firm holds this address."]);

export async function requestContact(request: ContactRequest): Promise<ContactAnswer> {
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      body: JSON.stringify(request),
    });
  } catch {
    throw new ContactRequestError("failed", FAILED);
  }
  const body = (await res.json().catch(() => null)) as { answer?: unknown; error?: unknown } | null;
  if (res.ok) return body?.answer === "busy" ? "busy" : body?.answer === "taken" ? "taken" : fail();
  // The database wrote the words of a refused field (22023, 422) for a visitor; the function wrote the others'. Nothing else is shown.
  if (res.status === 422 && typeof body?.error === "string") throw new ContactRequestError("invalid", body.error);
  if (typeof body?.error === "string" && VISITOR_WORDS.has(body.error)) throw new ContactRequestError("failed", body.error);
  return fail();
}

function fail(): never {
  throw new ContactRequestError("failed", FAILED);
}
