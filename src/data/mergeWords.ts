import type { MergeChoice, MergeKind } from "@/data/merge";

// What the merge screens say (story CRM-S4.3a; docs/BROKER_CRM_BUILD.md D-660 to D-669), beside the database side's words in merge.ts (CRM-S4.3b): how a value reads in
// the side-by-side choice, where each choice starts, what would move and what happened. Words only: who may merge and what moves are the database's.

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const CALLS = ["call, note or task", "calls, notes and tasks"] as const;

/** A record's name as the dialog says it: an account's name, a contact's first and last name. */
export const mergeRecordName = (kind: MergeKind, record: Record<string, unknown>): string =>
  kind === "account"
    ? String(record.name ?? "")
    : [record.first_name, record.last_name].filter((p): p is string => typeof p === "string" && p.trim() !== "").join(" ");

/** Whether a field holds nothing: it is the one a merge fills from the other record (D-640). */
export const isBlankValue = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);

/** A field's value as the choice shows it: blank is said, a list is joined, a yes or no is a word, an owner is a name. */
export function mergeValueWords(field: string, value: unknown): string {
  if (field === "do_not_email") return value ? "Yes" : "No";
  if (field === "owner") return value && typeof value === "object" && "name" in value ? String((value as { name: unknown }).name) : "No owner";
  if (isBlankValue(value)) return "Blank";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

/**
 * The choice a field starts on, which is what the database does when a field is not named (D-640, D-641): the kept record's value, or the removed one's when the kept
 * one is blank; "do not email" is on when either was (the safe side for someone who asked not to be emailed).
 */
export function defaultMergeChoice(field: string, kept: Record<string, unknown>, removed: Record<string, unknown>): MergeChoice {
  if (field === "do_not_email") return removed.do_not_email === true && kept.do_not_email !== true ? "removed" : "kept";
  return isBlankValue(kept[field]) && !isBlankValue(removed[field]) ? "removed" : "kept";
}

/** What would move to the kept record, from the preview's counts (nothing is said of what has none). */
export function mergeMovesWords(kind: MergeKind, moves: Record<string, number>, keptName: string): string[] {
  const n = (key: string) => moves[key] ?? 0;
  const lines: string[] = [];
  if (kind === "account") {
    const parts = [
      n("contacts") > 0 && count(n("contacts"), "contact", "contacts"),
      n("opportunities") > 0 && count(n("opportunities"), "opportunity", "opportunities"),
      n("activities") > 0 && count(n("activities"), ...CALLS),
      n("placements") > 0 && count(n("placements"), "placement", "placements"),
      n("renewals") > 0 && count(n("renewals"), "renewal", "renewals"),
      n("labels") > 0 && count(n("labels"), "label", "labels"),
    ].filter((p): p is string => !!p);
    lines.push(parts.length === 0
      ? `Nothing is attached to the account that will be removed, so there is nothing to move to ${keptName}.`
      : `${parts.join(", ")} ${parts.length === 1 && parts[0].startsWith("1 ") ? "moves" : "move"} to ${keptName}.`);
    if (n("intakes") > 0) lines.push(`${count(n("intakes"), "intake stays", "intakes stay")} on ${n("intakes") === 1 ? "its own" : "their own"} opportunity.`);
  } else {
    lines.push(n("activities") > 0
      ? `${count(n("activities"), ...CALLS)} ${n("activities") === 1 ? "moves" : "move"} to ${keptName}.`
      : "No calls, notes or tasks are on the contact that will be removed.");
    const main = n("opportunities_main_contact_of");
    if (main > 0) lines.push(`${count(main, "opportunity names", "opportunities name")} the contact that will be removed as the main contact; ${main === 1 ? "it" : "they"} will name ${keptName} instead.`);
  }
  lines.push(`The history moves too, marked as from the removed record, and the old address leads to ${keptName}.`);
  return lines;
}

/** What a merge did, for the line that confirms it. */
export function mergedWords(kind: MergeKind, keptName: string, removedName: string, moved: { contacts?: number; opportunities?: number; activities?: number }): string {
  const base = `${removedName} was merged into ${keptName}.`;
  const along = [
    kind === "account" && (moved.contacts ?? 0) > 0 && count(moved.contacts ?? 0, "contact", "contacts"),
    kind === "account" && (moved.opportunities ?? 0) > 0 && count(moved.opportunities ?? 0, "opportunity", "opportunities"),
    (moved.activities ?? 0) > 0 && count(moved.activities ?? 0, ...CALLS),
  ].filter((p): p is string => !!p);
  return along.length === 0 ? base : `${base} ${along.join(", ")} moved over.`;
}

/** The note a kept record's page shows after the old address led there (D-203, D-664). */
export const mergedNoteWords = (keptName: string): string => `That address belonged to a record that was merged into ${keptName}. This is the page it became.`;

/** What "Keep separate" did. */
export const keptSeparateWords = (otherName: string | null): string =>
  otherName ? `Kept separate from ${otherName}. The possible-duplicate mark is gone.` : "Kept separate. The possible-duplicate mark is gone.";
