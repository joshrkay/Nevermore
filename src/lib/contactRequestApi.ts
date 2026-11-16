import { supabase } from "@/integrations/supabase/client";

// What the "contact me" form on a firm's public link asks the database (story CRM-L1.2b, slice 8.7; 20261122230000_request_contact.sql): one call, which makes a
// lead of the firm the address names. The firm is the database's to find from the address, never the browser's word (D-101). The database decides every rule
// (the fields, a closing firm, how many an hour); this only puts its answer into the page's shape.

/** What the visitor typed, every text as typed (a blank is nothing). */
export interface ContactRequest {
  /** The firm's address, from the host the visitor is at. */
  address: string;
  name: string;
  email: string;
  phone: string;
  business: string;
  message: string;
}

/** "taken": the firm has it (a repeat of the same email counts as taken). "busy": the link has had its share for this hour, try later. */
export type ContactAnswer = "taken" | "busy";

const FAILED = "Couldn't send your request. Try again.";

/** A refusal in words: `invalid` (the database says what is wrong with a field) or `failed`. */
export class ContactRequestError extends Error {
  constructor(readonly kind: "invalid" | "failed", message: string) {
    super(message);
  }
}

export async function requestContact(request: ContactRequest): Promise<ContactAnswer> {
  const { data, error } = await supabase.rpc("request_contact", {
    p_address: request.address,
    p_name: request.name,
    p_email: request.email,
    p_phone: request.phone,
    p_business: request.business,
    p_message: request.message,
  });
  if (error) {
    // The database wrote the words of a refused field (22023), a closing firm (PT423) and an address no firm holds (PT404) for a visitor; nothing else is shown.
    if (error.code === "22023") throw new ContactRequestError("invalid", error.message);
    if (error.code === "PT423" || error.code === "PT404") throw new ContactRequestError("failed", error.message);
    throw new ContactRequestError("failed", FAILED);
  }
  return data === "busy" ? "busy" : "taken";
}
