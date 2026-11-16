import { z } from "zod";
import { nameRule, optionalEmailRule, phoneRule, stateRule, wholeNumberRule } from "@/components/workspace/form/fieldRules";
import type { LeadEdit, LeadEditable, LeadFields } from "@/lib/leadPageApi";

// A lead's own fields as the edit form on its page holds them (story CRM-L2.1, screen 15): the form's rules, its starting values and what it sends. The rules
// are New lead's (CRM-L1.2a) and the database's (lead_input_error, 20261121100000), so a form that takes a value is a form the database takes.

const text = z.string().trim();

export const leadEditSchema = z.object({
  name: nameRule("Enter a name: the person's, or the business's when you don't know who to speak to.", 200),
  title: text,
  business: text,
  email: optionalEmailRule(),
  phone: phoneRule(),
  city: text,
  state: stateRule(),
  employees: wholeNumberRule(),
  current_provider: text,
  note: text,
  owner_id: z.string(),
});

export type LeadForm = {
  name: string; title: string; business: string; email: string; phone: string; city: string; state: string; employees: string; current_provider: string;
  note: string; owner_id: string;
};

/** The form's starting values from the lead (or, in a conflict, from what is there now). Field names are the database's columns, so a conflict can set what was typed beside what is there. */
export const leadFormOf = (l: LeadEditable): LeadForm => ({
  name: l.name, title: l.title ?? "", business: l.business ?? "", email: l.email ?? "", phone: l.phone ?? "", city: l.city ?? "", state: l.state ?? "",
  employees: l.employees === null ? "" : String(l.employees), current_provider: l.currentProvider ?? "", note: l.note ?? "", owner_id: l.ownerId ?? "",
});

export const leadFormOfLead = (l: LeadFields): LeadForm => leadFormOf({ ...l, ownerId: l.owner?.id ?? null });

/**
 * What converting the lead would make (CRM-L2.1's "Converting makes"; CRM-L2.2, D-810, D-1653): an account named after the business (the lead's name when it has
 * none), a contact named after the person unless the lead's name is its business's (a business and no person makes no contact), and an opportunity named
 * "<account> – PEO search".
 */
export const convertingMakes = (l: Pick<LeadFields, "name" | "business">): { account: string; contact: string | null; opportunity: string } => {
  const account = (l.business ?? "").trim() || l.name.trim();
  const noPerson = (l.business ?? "").trim() !== "" && l.name.trim().toLowerCase() === (l.business ?? "").trim().toLowerCase();
  return { account, contact: noPerson ? null : l.name.trim(), opportunity: `${account} – PEO search` };
};

/** What the form sends: every field, a blank as typed (the database clears it), an owner left empty as "keep". */
export const leadEditOf = (f: LeadForm): LeadEdit => ({
  name: f.name, title: f.title, business: f.business, email: f.email, phone: f.phone, city: f.city, state: f.state, employees: f.employees,
  currentProvider: f.current_provider, note: f.note, ownerId: f.owner_id === "" ? null : f.owner_id,
});
