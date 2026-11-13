import { z } from "zod";

/**
 * The rules this story can apply now, written once for every workspace form (CRM-S4.1, D-24, D-50): a name is
 * required, and an email must look like one. They return zod schemas, so a form's schema is a plain object of
 * these. Phone, state and date rules arrive with CRM-A1.2, the first form that has such a field.
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
