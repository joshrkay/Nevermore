import { z } from "zod";
import { US_STATE_CODES } from "@/data/chamberValidation";

/**
 * The rules this story can apply now, written once for every workspace form (CRM-S4.1, D-24, D-50): a name is
 * required, and an email must look like one. They return zod schemas, so a form's schema is a plain object of
 * these. The phone, state, date and whole-number rules came with CRM-A1.2, the first form that has such fields.
 *
 * Each rule trims what was typed, so a name of spaces is "missing" and the value a form saves has no stray spaces.
 */

/** Mirrors the pattern the invitation server function applies, so the form never accepts what the server would refuse for its shape. */
const LOOKS_LIKE_EMAIL = /^[^\s@<>,;"()[\]\\]+@[^\s@<>,;"()[\]\\]+\.[^\s@<>,;"()[\]\\]+$/;

/** A required name. `missing` is the sentence shown when it is empty or only spaces, for example "Enter the partner's name." */
export const nameRule = (missing: string, max?: number) => {
  const base = z.string().trim().min(1, missing);
  return max === undefined ? base : base.max(max, `Use ${max} characters or fewer.`);
};

/** A required email address. */
export const emailRule = (missing: string) =>
  z
    .string()
    .trim()
    .min(1, missing)
    .refine((v) => v === "" || LOOKS_LIKE_EMAIL.test(v), "Enter an email address like name@example.com.");

/** An email that may be left empty; when something is typed it must look like one. For later forms (a contact's email). */
export const optionalEmailRule = () =>
  z.string().trim().refine((v) => v === "" || LOOKS_LIKE_EMAIL.test(v), "Enter an email address like name@example.com.");

/** A choice that must be made from a list. `missing` is the sentence shown while nothing is chosen. */
export const choiceRule = <T extends string>(allowed: readonly T[], missing: string) =>
  z.string().refine((v): v is T => (allowed as readonly string[]).includes(v), missing);

/**
 * A phone number that may be left empty. It is the repository's own rule (`is_valid_phone`, 20261027090000): 7 to 15 digits with only spaces, brackets, dots
 * and dashes between them, a plus only at the start, an optional extension ("x12", "ext. 345"), at most 50 characters. A phone is judged only when it is
 * changed (as `validate_profile_phone` and the account's trigger do): pass `kept`, the phone the record had when the edit began, and typing it again is taken
 * whatever it looks like, so a record with an older phone can still save its other fields.
 */
export const PHONE_WORDS = "Enter a phone number like (503) 555-0142. An extension can follow, like x12.";
export const phoneRule = (kept?: string | null) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || v === (kept ?? "").trim() || isValidPhone(v), PHONE_WORDS);

const PHONE_SHAPE = /^\+?[0-9 ().-]+(\s*(x|ext\.?)\s*[0-9]{1,6})?$/i;
const digitsBeforeExtension = (v: string) => v.replace(/\s*(x|ext\.?)\s*[0-9]{1,6}$/i, "").replace(/[^0-9]/g, "").length;
const isValidPhone = (v: string) => v.length <= 50 && PHONE_SHAPE.test(v) && digitsBeforeExtension(v) >= 7 && digitsBeforeExtension(v) <= 15;

/** A state that may be left empty: one of the state codes, in either case, kept in capitals. */
export const stateRule = () =>
  z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || US_STATE_CODES.includes(v), "Choose a state from the list.");

/** A day that may be left empty, as a date field gives it ("2027-01-15"): it must be a day that exists. */
export const dateRule = () =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (v === "") return true;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      if (!m) return false;
      const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const d = new Date(Date.UTC(year, month - 1, day));
      return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
    }, "Enter a date like 2027-01-15.");

/** A count that may be left empty: digits only. */
export const MOST_WHOLE_NUMBER = 2_147_483_647;
export const wholeNumberRule = () =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), "Enter a whole number, like 45.")
    // The database keeps a count as an integer: anything bigger is said here, in words, not met as a failed save.
    .refine((v) => !/^\d+$/.test(v) || BigInt(v) <= BigInt(MOST_WHOLE_NUMBER), "Enter a number up to 2,147,483,647.");
