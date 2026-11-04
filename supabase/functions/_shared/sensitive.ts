// Social Security numbers and bank details are never stored with an intake. Text that reaches
// chamber_data, the transcript or a document's extraction passes through redactSensitive first,
// so a number typed into the chat or read out of a document is replaced before it is saved or
// sent to the model. No imports: document-extract runs it under Deno, and the front end
// re-exports it (src/data/sensitive.ts), so both sides apply the same rules.

export const REDACTED = "[redacted]";

// Between an SSN's groups: a hyphen, a space, or the en or em dash a word processor substitutes.
const SSN_SEPARATOR = "[- \\u2013\\u2014]";
// 123-45-6789, 123 45 6789, 123–45–6789 or 123.45.6789: the shape of an SSN or ITIN. Dots count only
// when both separators are dots, so an amount next to another number (512.40 1124.80) is left alone.
const FORMATTED_SSN = new RegExp(`\\b\\d{3}(?:${SSN_SEPARATOR}\\d{2}${SSN_SEPARATOR}|\\.\\d{2}\\.)\\d{4}\\b`, "g");
// An SSN typed straight after its label, where no word boundary sets the digits apart: "ssn123456789",
// "SSN_123-45-6789", "myssn123.45.6789", "SS123-45-6789".
const GLUED_SSN = new RegExp(
  `(ssn?_?)\\d{3}(?:${SSN_SEPARATOR}?\\d{2}${SSN_SEPARATOR}?|\\.\\d{2}\\.)\\d{4}(?!\\d)`,
  "gi",
);
// A labelled account or routing number: "acct # 0012345", "routing: 021000021".
const LABELLED_ACCOUNT = /\b(account|acct|routing|aba)(?:\s*(?:number|num|no\.?|#))?\s*[:#]?\s*\d[\d -]{2,}\d/gi;
// A card number of 13 to 19 digits in groups, split by spaces or hyphens: three groups of four, then
// the rest in one group or as four and up to three (4111 1111 1111 1111, 6011-0009-9013-9424-124).
const GROUPED_CARD = /\b\d{4}(?:[- ]\d{4}){2}[- ](?:\d{4}[- ]\d{1,3}|\d{1,7})\b/g;
// An American Express number, grouped four, six, five: 3782 822463 10005.
const GROUPED_AMEX = /\b\d{4}[- ]\d{6}[- ]\d{5}\b/g;
// How card numbers start: Mastercard's 2221 to 2720 (taken as 22 to 27), then 3 (American Express, Diners,
// JCB), 4 (Visa), 5 (Mastercard) and 6 (Discover). No year starts this way.
const CARD_START = /^(?:2[2-7]|[3-6])/;
// Nine or more digits in a row: an unformatted SSN, a routing number or an account number.
const LONG_DIGIT_RUN = /\b\d{9,17}\b/g;

// The check digit every card number carries (Luhn).
function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

const isCardNumber = (digits: string) => CARD_START.test(digits) && passesLuhn(digits);

// Digits in a card's groups are redacted only when they could be a card, so a row of years, plan years
// or class codes stays readable. Past 16 digits, the first 16 are checked too: a short last group can
// be the security code typed after a card, rather than the end of a longer one.
const couldBeCard = (match: string) => {
  const digits = match.replace(/\D/g, "");
  return isCardNumber(digits) || (digits.length > 16 && isCardNumber(digits.slice(0, 16)));
};

// A window of groups that isn't a card can still hold one from its second group on ("1042 4111 1111
// 1111 1111"), so the search resumes at that group rather than after the window.
function redactCards(text: string, pattern: RegExp): string {
  const re = new RegExp(pattern);
  let out = "";
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (couldBeCard(m[0])) {
      out += text.slice(last, m.index) + REDACTED;
      last = re.lastIndex;
    } else {
      re.lastIndex = m.index + 5; // past the first group of four and its separator
    }
  }
  return out + text.slice(last);
}

export function redactSensitive(text: string): string {
  const withoutIds = text
    .replace(LABELLED_ACCOUNT, (_match, label: string) => `${label} ${REDACTED}`)
    .replace(GLUED_SSN, (_match, label: string) => `${label}${REDACTED}`)
    .replace(FORMATTED_SSN, REDACTED);
  return redactCards(redactCards(withoutIds, GROUPED_CARD), GROUPED_AMEX).replace(LONG_DIGIT_RUN, REDACTED);
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
