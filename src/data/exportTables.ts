// What each table an export can take is called on screen (story CRM-S3.8a): in the sentence that says how many rows were taken, in the line of the
// firm's record that says an export was made, and in the name of the file. The database holds the list (`export_table_registry()` in
// 20261119090000_export.sql, and src/lib/exportApi.ts's `ExportTable`); a table added there is added here, and the type says so.
import type { ExportTable } from "@/lib/exportApi";

interface ExportTableWords {
  /** One row, and several, after a count: "1 referral partner", "42 referral partners". */
  one: string;
  many: string;
  /** The start of the file's name; the day follows it. */
  file: string;
}

const WORDS: Record<ExportTable, ExportTableWords> = {
  referral_partners: { one: "referral partner", many: "referral partners", file: "referral-partners" },
  firm_activity: { one: "entry in the firm's record", many: "entries in the firm's record", file: "firm-record" },
  accounts: { one: "account", many: "accounts", file: "accounts" },
};

const known = (table: string): table is ExportTable => Object.prototype.hasOwnProperty.call(WORDS, table);

/**
 * "Exported 42 referral partners": what an export made of `count` rows of `table` is called. A table this version does not know yet is named as the
 * database wrote it, so a later table's entry still reads as a sentence.
 */
export const exportedWords = (table: string, count: number): string => {
  const noun = known(table) ? (count === 1 ? WORDS[table].one : WORDS[table].many) : `rows of ${table}`;
  return `Exported ${count.toLocaleString("en-US")} ${noun}`;
};

/** What is said of selected records the export left out (deleted, or no longer the person's to see): "1 selected account is no longer available." */
export const skippedWords = (table: string, count: number): string => {
  const noun = known(table) ? (count === 1 ? WORDS[table].one : WORDS[table].many) : "rows";
  return count === 1 ? `1 selected ${noun} is no longer available.` : `${count.toLocaleString("en-US")} selected ${noun} are no longer available.`;
};

/** The name of the file an export of `table` is saved as, on the day it was made ("referral-partners-2026-11-19.csv"). */
export const exportFileName = (table: ExportTable, day: string): string => `${WORDS[table].file}-${day}.csv`;
