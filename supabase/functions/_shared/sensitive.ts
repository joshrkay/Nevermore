// Social Security numbers and bank details are never stored with an intake. Text that reaches
// chamber_data, the transcript or a document's extraction passes through redactSensitive first,
// so a number typed into the chat or read out of a document is replaced before it is saved or
// sent to the model. No imports: document-extract runs it under Deno, and the front end
// re-exports it (src/data/sensitive.ts), so both sides apply the same rules.

export const REDACTED = "[redacted]";

// 123-45-6789 or 123 45 6789: the shape of an SSN or ITIN.
const FORMATTED_SSN = /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g;
// A labelled account or routing number: "acct # 0012345", "routing: 021000021".
const LABELLED_ACCOUNT = /\b(account|acct|routing|aba)(?:\s*(?:number|num|no\.?|#))?\s*[:#]?\s*\d[\d -]{2,}\d/gi;
// Nine or more digits in a row: an unformatted SSN, a routing number or an account number.
const LONG_DIGIT_RUN = /\b\d{9,17}\b/g;

export function redactSensitive(text: string): string {
  return text
    .replace(LABELLED_ACCOUNT, (_match, label: string) => `${label} ${REDACTED}`)
    .replace(FORMATTED_SSN, REDACTED)
    .replace(LONG_DIGIT_RUN, REDACTED);
}

/** True when the text holds something redactSensitive would remove. */
export function hasSensitive(text: string): boolean {
  return redactSensitive(text) !== text;
}

// Spreadsheet columns that hold an SSN or bank details. Their cells are never read.
const SENSITIVE_HEADER =
  /^(ssn|ss|soc sec|social|social security|social security number|social security no|ssn last 4|tin|itin|tax id|taxpayer id|bank|bank name|bank account|bank account number|account|account number|acct|acct number|acct no|routing|routing number|aba|aba number|direct deposit|direct deposit account|iban|swift)$/;

/** Whether a (normalised: lower case, words separated by single spaces) header names sensitive data. */
export function isSensitiveHeader(normalizedHeader: string): boolean {
  return SENSITIVE_HEADER.test(normalizedHeader);
}
