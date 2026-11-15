import type { BulkAction, BulkField, BulkOutcome, SkippedAccount, UndoOutcome } from "@/lib/bulkChangeApi";

// The words of a bulk change on the Accounts table (story CRM-S3.7a, screens 35 and 36): what the dialog says will happen, what a change did, what an undo did.
// Counts and names come from the database's own answer (CRM-S3.7b), never from the page's guess; the reasons a record was skipped are the database's own words.

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
export const accountsWords = (n: number) => plural(n, "account", "accounts");

/** The fields "Set a field" offers, as the account's form words them. */
export const FIELD_WORDS: Record<BulkField, string> = {
  trade_name: "Trade name",
  website: "Website",
  phone: "Phone",
  street: "Street",
  city: "City",
  state: "State",
  postal_code: "ZIP",
  industry: "Industry",
  employees: "Employees",
  states_of_operation: "States of operation",
  current_provider: "Current provider",
};

/** What a person typed for a field, as the change sends it: blank clears (null), employees a number, the states a list. */
export const valueSent = (field: BulkField, typed: string): string | number | string[] | null => {
  const v = typed.trim();
  if (field === "states_of_operation") return v === "" ? [] : [...new Set(v.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (v === "") return null;
  return field === "employees" ? Number(v) : v;
};

const shownValue = (value: string | number | string[] | null): string | null =>
  value === null ? null : Array.isArray(value) ? (value.length > 0 ? value.join(", ") : null) : String(value);

/**
 * What a change does, in a phrase that follows "This will" (the dialog) or stands as a sentence (what happened, with `past`):
 * "change the owner to Marcus Hale on 42 accounts" / "Changed the owner to Marcus Hale on 42 accounts".
 */
export function changeWords(action: BulkAction, count: number, ownerName: string | null, past: boolean): string {
  const n = accountsWords(count);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  let words: string;
  switch (action.action) {
    case "owner": words = `${past ? "changed" : "change"} the owner to ${ownerName ?? "the new owner"} on ${n}`; break;
    case "archive": words = `${past ? "archived" : "archive"} ${n}`; break;
    case "label_add": words = `${past ? "added" : "add"} the label "${action.name}" to ${n}`; break;
    case "label_remove": words = `${past ? "removed" : "remove"} the label "${action.name}" from ${n}`; break;
    case "field": {
      const shown = shownValue(action.value);
      words = shown === null
        ? `${past ? "cleared" : "clear"} ${FIELD_WORDS[action.field]} on ${n}`
        : `set ${FIELD_WORDS[action.field]} to "${shown}" on ${n}`;
      break;
    }
  }
  return past ? cap(words) : words;
}

/** What "already as asked" is, for the line about accounts that stay as they are: one account, then several. */
const ALREADY: Record<BulkAction["action"], [string, string]> = {
  owner: ["already belongs to that owner", "already belong to that owner"],
  archive: ["is already archived", "are already archived"],
  label_add: ["already has that label", "already have that label"],
  label_remove: ["doesn't have that label", "don't have that label"],
  field: ["already holds that value", "already hold that value"],
};

export const skippedLine = (s: SkippedAccount): string => `${s.name ?? "An account"}: ${s.reason}`;

/** The line about accounts the person can no longer see or that are gone: counted, never named. */
export const unavailableWords = (n: number): string =>
  `${plural(n, "selected account is", "selected accounts are")} no longer available to you, so ${n === 1 ? "it is" : "they are"} left out.`;

/** The line about accounts that are already as asked. */
export const unchangedWords = (n: number, action: BulkAction): string =>
  `${accountsWords(n)} ${ALREADY[action.action][n === 1 ? 0 : 1]}, so ${n === 1 ? "it stays as it is" : "they stay as they are"}.`;

/** What a change that was made says, with the open opportunities it took along. */
export function madeWords(action: BulkAction, outcome: BulkOutcome, withOpportunities: boolean): string {
  const base = changeWords(action, outcome.changed, outcome.ownerName, true);
  const opp = withOpportunities && outcome.opportunities ? outcome.opportunities : null;
  const tail = opp && opp.changed > 0 ? `, and ${plural(opp.changed, "open opportunity", "open opportunities")}` : "";
  return `${base}${tail}.`;
}

/** What an undo did, one sentence a part: the restored, the skipped (named by the caller), the deleted. */
export function undoneWords(u: UndoOutcome): string[] {
  const lines = [u.restored === 0 ? "Nothing was put back." : `${plural(u.restored, "account is", "accounts are")} back as ${u.restored === 1 ? "it was" : "they were"}.`];
  if (u.opportunities.restored > 0) lines.push(`${plural(u.opportunities.restored, "open opportunity is", "open opportunities are")} back as ${u.opportunities.restored === 1 ? "it was" : "they were"}.`);
  if (u.opportunities.skipped > 0) lines.push(`${plural(u.opportunities.skipped, "open opportunity was", "open opportunities were")} left as ${u.opportunities.skipped === 1 ? "it is" : "they are"}, because it changed since.`);
  if (u.gone > 0) lines.push(`${plural(u.gone, "account was", "accounts were")} deleted since, so there is nothing to put back.`);
  if (u.opportunities.gone > 0) lines.push(`${plural(u.opportunities.gone, "open opportunity was", "open opportunities were")} deleted since.`);
  return lines;
}
