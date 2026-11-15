import { z } from "zod";
import { nameRule, phoneRule, stateRule, wholeNumberRule } from "@/components/workspace/form/fieldRules";
import { US_STATE_CODES } from "@/data/chamberValidation";
import { statesOf } from "@/data/accountPage";

// The rules of an account's own fields as a form applies them, one list for the form that makes an account (CRM-A1.2) and the one that edits it in place
// (CRM-A2.1b), so the two never disagree. The database asks the same rules (account_input_error), so a form that takes a value is a form the database takes.

const text = z.string().trim();

/** States of operation typed as codes, separated by commas or spaces: each must be a state from the list. */
export const statesOfOperationRule = () =>
  text.refine((v) => statesOf(v).every((s) => US_STATE_CODES.includes(s)), "Use two-letter state codes from the list, like OR, WA.");

export const accountFieldsSchema = z.object({
  name: nameRule("Enter the account's name.", 200),
  trade_name: text,
  website: text,
  phone: phoneRule(),
  street: text,
  city: text,
  state: stateRule(),
  postal_code: text,
  industry: text,
  employees: wholeNumberRule(),
  states_of_operation: statesOfOperationRule(),
  current_provider: text,
});
