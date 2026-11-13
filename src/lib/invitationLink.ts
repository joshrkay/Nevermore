// Where an invitation's link opens (story CRM-P1.2, D-34): `/join` at the firm's address, with the secret in the part after the `#`.
// A browser never sends that part to a server, so it reaches no request log and no Referer, and no route of the app contains it. The
// server function that emails the link (supabase/functions/invite-member) builds the same address.
export const JOIN_PATH = "/join";

const STORAGE_KEY = "nevermore.invitation";

function stored(): string {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * The invitation's token, for the page that joins. If the address carries one (`#token=...`) it is read and taken out of the address bar
 * at once (history.replaceState), and kept in this tab's session storage so that it survives going to sign in and coming back, which
 * leaves the page. With none in the address, the one kept for this tab. Never sent anywhere but to the database's hash of it.
 */
export function takeInvitationToken(): string {
  let fromAddress = "";
  try {
    fromAddress = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") ?? "";
  } catch {
    // a fragment that isn't a query string, e.g. a section id
  }
  if (!fromAddress) return stored();
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  try {
    window.sessionStorage.setItem(STORAGE_KEY, fromAddress);
  } catch {
    // no storage: the page keeps it for as long as it is open
  }
  return fromAddress;
}

/** Forgets the kept token, once the person has joined. */
export function forgetInvitationToken(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing kept
  }
}
