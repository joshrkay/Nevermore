import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCOUNT_MERGE_FIELDS, CONTACT_MERGE_FIELDS, MERGE_FIELD_LABELS, mergeChoiceWords, mergedEntryWords, mergedFromWords, mergeWarning } from "@/data/merge";

const migration = readFileSync("supabase/migrations/20261120140000_merge_records.sql", "utf8");

// The fields a merge may be told about are the database's list (merge_accounts and merge_contacts refuse any other): one list in two places drifts.
const allowedIn = (fn: string): string[] => {
  const body = migration.slice(migration.indexOf(`CREATE FUNCTION public.${fn}(`));
  const m = /crm_merge_choices_error\(ch, ARRAY\[([^\]]*)\]\)/.exec(body);
  if (!m) throw new Error(`no list of fields in ${fn}`);
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
};

describe("merge words and fields", () => {
  // Break caught: a field the screen offers a choice for that the database refuses ("Choose only among the fields that can differ."), or one the database takes that no screen offers.
  it("lists the account fields the database accepts, in order", () => {
    expect([...ACCOUNT_MERGE_FIELDS]).toEqual(allowedIn("merge_accounts"));
  });

  it("lists the contact fields the database accepts, in order", () => {
    expect([...CONTACT_MERGE_FIELDS]).toEqual(allowedIn("merge_contacts"));
  });

  // Break caught: a field shown to the person by its code ("postal_code").
  it("has words for every field", () => {
    for (const f of [...ACCOUNT_MERGE_FIELDS, ...CONTACT_MERGE_FIELDS]) expect(MERGE_FIELD_LABELS[f]).toMatch(/^[A-Z][A-Za-z ]+$/);
  });

  // Break caught: the confirm step saying nothing of what cannot be undone (D-203: there is no unmerge), or naming the wrong record as deleted.
  it("warns that the removed record is deleted and the merge can't be undone", () => {
    expect(mergeWarning("account", "Harborview Marine", "Harborview Marine LLC")).toBe(
      "Harborview Marine LLC will be deleted and everything on it moved to Harborview Marine. A merged account can't be split again.");
    expect(mergeWarning("contact", "Sam Reyes", "S. Reyes")).toContain("A merged contact can't be split again.");
  });

  it("says which value each choice keeps, and where a history entry came from", () => {
    expect(mergeChoiceWords("kept", "Harborview Marine", "Harborview Marine LLC")).toBe("Keep Harborview Marine");
    expect(mergeChoiceWords("removed", "Harborview Marine", "Harborview Marine LLC")).toBe("Use Harborview Marine LLC");
    expect(mergedEntryWords("Harborview Marine LLC")).toBe("Merged in Harborview Marine LLC");
    expect(mergedFromWords("Harborview Marine LLC")).toBe("From Harborview Marine LLC, merged");
  });
});
