// The words of the registration record (Q-2.1) and of the warning about a second submission (Q-2.2, D-604), slice 6.10.
import { csvField, csvLines } from "@/lib/csv";
import type { RegistrationStatement } from "@/lib/peoRegistrationsApi";

/**
 * The firm's statement as a CSV (D-1636): two lines that say whose it is and when it was taken (the database's own moment), a blank line, then one row
 * per registration, oldest first, as the database gave them. Every cell is made safe to open in a spreadsheet (csvField); it starts with a byte order
 * mark so a name with an accent reads as written. Named for the day it was taken.
 */
export function registrationStatementFile(s: RegistrationStatement): { blob: Blob; name: string } {
  const lines = [
    ["Statement of registrations with PEOs", s.firm].map(csvField),
    ["As of", s.as_of].map(csvField),
    [],
    ["Registered at", "PEO", "Employer", "State", "FEIN (last four)", "File ID", "Version"].map(csvField),
    ...s.rows.map((r) => [r.registered_at, r.peo, r.employer, r.state, r.fein_last_four, r.file_id, r.version].map(csvField)),
  ];
  const day = /^\d{4}-\d{2}-\d{2}/.exec(s.as_of)?.[0] ?? new Date().toISOString().slice(0, 10);
  return { blob: new Blob(["\uFEFF", csvLines(lines)], { type: "text/csv;charset=utf-8" }), name: `registrations-with-peos-${day}.csv` };
}

/** A registration's day as the advisor reads it, in their own time zone: "Nov 3". */
export const registrationDay = (at: string): string => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * The warning before a send (D-604): that another firm registered this employer with this PEO, and when; never who. It warns and never blocks.
 * Null when no other firm has.
 */
export function registeredElsewhereWords(rows: readonly { peo: string; registered_at: string }[], peo: string): string | null {
  const row = rows.find((r) => r.peo.toLowerCase() === peo.trim().toLowerCase());
  return row ? `Another firm registered this employer with this PEO on ${registrationDay(row.registered_at)}.` : null;
}
