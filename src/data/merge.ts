// What merging says (story CRM-S4.3b; docs/BROKER_CRM_BUILD.md D-203, D-210, D-640 to D-649). Words and the lists of fields a person can choose between only: who may
// merge, what moves and what is refused are the database's (20261121100000_merge_records.sql). The screens that use these are CRM-S4.3a's.

export const MERGE_KINDS = ["account", "contact"] as const;
export type MergeKind = (typeof MERGE_KINDS)[number];

/** The fields of two accounts a person picks between when they differ, in the order the screen lists them (the database's own list: `merge_preview`'s `differs`). */
export const ACCOUNT_MERGE_FIELDS = [
  "name", "trade_name", "website", "phone", "street", "city", "state", "postal_code", "industry", "employees", "states_of_operation", "current_provider", "owner",
] as const;
export type AccountMergeField = (typeof ACCOUNT_MERGE_FIELDS)[number];

export const CONTACT_MERGE_FIELDS = ["first_name", "last_name", "title", "email", "phone", "mobile", "do_not_email", "owner"] as const;
export type ContactMergeField = (typeof CONTACT_MERGE_FIELDS)[number];

export const MERGE_FIELD_LABELS: Record<AccountMergeField | ContactMergeField, string> = {
  name: "Name", trade_name: "Trade name", website: "Website", phone: "Phone", street: "Street", city: "City", state: "State", postal_code: "Postal code",
  industry: "Industry", employees: "Employees", states_of_operation: "States of operation", current_provider: "Current provider", owner: "Owner",
  first_name: "First name", last_name: "Last name", title: "Title", email: "Email", mobile: "Mobile", do_not_email: "Do not email",
};

/** Which record's value a field keeps. A field left out keeps the kept record's value, or the removed one's when the kept one is blank (D-640). */
export type MergeChoice = "kept" | "removed";
export type MergeChoices<F extends string> = Partial<Record<F, MergeChoice>>;

/** The two records' words for the choice: "Keep Harborview Marine" / "Use Harborview Marine LLC". */
export const mergeChoiceWords = (choice: MergeChoice, keptName: string, removedName: string): string => (choice === "kept" ? `Keep ${keptName}` : `Use ${removedName}`);

/** The merge sentence the confirm step says (D-203: there is no unmerge). */
export function mergeWarning(kind: MergeKind, keptName: string, removedName: string): string {
  const what = kind === "account" ? "account" : "contact";
  return `${removedName} will be deleted and everything on it moved to ${keptName}. A merged ${what} can't be split again.`;
}

/** What the merge entry in a record's history says (D-203): the record it absorbed. */
export const mergedEntryWords = (removedName: string): string => `Merged in ${removedName}`;

/** What a copied entry says about where it came from (D-203: "marked as from the merged record"). */
export const mergedFromWords = (removedName: string): string => `From ${removedName}, merged`;
