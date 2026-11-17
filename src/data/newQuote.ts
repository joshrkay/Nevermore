// New quote (CRM-Q2.1, slice 5.4; D-1702, D-1709, D-1763). Steps 2 to 4 are the existing /start chamber (founder's direction), so there is no steps list here:
// `stepToOpenAt` is only the seam where a Continue will open the intake for an opportunity once slice 5.3's start-intake function exists.

/** The four steps of a quote, in order. */
export type QuoteStep = 1 | 2 | 3 | 4;

/** What the opportunity's data shows of how far a New quote got. Null: there is no opportunity yet. */
export type QuoteProgress = null | { intake: null | { certified: boolean }; quotesSent: number };

/** How far a New quote got, read from the opportunity's own page: the intake it holds, whether it was certified, and how many quotes were sent (D-1702). */
export function progressOf(page: { intake: { certifiedAt: string | null } | null; quotes: { sentOn: string | null }[] }): QuoteProgress {
  return { intake: page.intake && { certified: page.intake.certifiedAt !== null }, quotesSent: page.quotes.filter((q) => q.sentOn !== null).length };
}

/** The step a New quote opens at, worked out from the data and never stored (D-1702). */
export function stepToOpenAt(progress: QuoteProgress): QuoteStep {
  if (progress === null) return 1;
  if (progress.intake === null) return 2;
  if (!progress.intake.certified) return 3;
  return 4;
}

/** Whether step 3 shows the existing certified view of the intake (the submission page's own panels): the intake is certified (CRM-Q2.4, D-1770). */
export function certifiedViewShows(progress: QuoteProgress): boolean {
  return progress?.intake?.certified === true;
}

/** A contact's one name box as the first and last names the contact record keeps: the first word is the first name, the rest the last name. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length === 0 ? { firstName: "", lastName: first ?? "" } : { firstName: first, lastName: rest.join(" ") };
}

/** What is wrong with a new account's fields in step 1, in words, by field. Empty when nothing is. */
export function newAccountProblems(v: { name: string; contactName: string; contactEmail: string; contactPhone: string }): Partial<Record<"name" | "contactName" | "contact", string>> {
  const problems: Partial<Record<"name" | "contactName" | "contact", string>> = {};
  if (v.name.trim() === "") problems.name = "Enter the account's name.";
  if (v.contactName.trim() === "") problems.contactName = "Enter the contact's name.";
  if (v.contactEmail.trim() === "" && v.contactPhone.trim() === "") problems.contact = "Give the contact an email or a phone.";
  return problems;
}
