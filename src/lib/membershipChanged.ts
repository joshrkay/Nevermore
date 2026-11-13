// A person's membership of a firm changed in this tab (they joined it by an invitation, story CRM-P1.2). The firm address gate asked
// whether they were a member before, and would go on showing "You aren't a member of this firm" until a reload: it listens for this
// and asks again.
const EVENT = "nevermore:membership-changed";

export function notifyMembershipChanged(): void {
  window.dispatchEvent(new Event(EVENT));
}

/** Calls `listener` whenever membership changes; returns what stops it. */
export function onMembershipChanged(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
