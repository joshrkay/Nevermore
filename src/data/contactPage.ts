import { z } from "zod";
import { nameRule, optionalEmailRule, phoneRule } from "@/components/workspace/form/fieldRules";
import type { ContactEdit, ContactEditable, ContactFields } from "@/lib/contactPageApi";

// A contact's own fields as the edit form on its page holds them (story CRM-C1.1, screen 18): the form's rules, its starting values and what it sends. The database
// asks the same rules (contact_update_error, 20261119240000), so a form that takes a value is a form the database takes.

const short = z.string().trim().max(100, "Use 100 characters or fewer.");
const EMAIL_WORDS = "Enter an email address like name@example.com.";

/**
 * The rules as the form applies them. An email, a phone or a mobile left as the contact had it when the edit began (`kept`, compared trimmed) is not judged for
 * its look again, as the database does, so a contact copied from an intake with an older-format phone can still save its other fields. A contact needs a last
 * name and a way to reach them: an email, a phone or a mobile.
 */
export const contactEditSchemaFor = (kept: { email: string | null; phone: string | null; mobile: string | null }) =>
  z
    .object({
      first_name: short,
      last_name: nameRule("Enter the contact's last name.", 100),
      title: short,
      email: z.string().trim().refine((v) => v === "" || v === (kept.email ?? "").trim() || optionalEmailRule().safeParse(v).success, EMAIL_WORDS),
      phone: phoneRule(kept.phone),
      mobile: phoneRule(kept.mobile),
      owner_id: z.string(),
      is_main: z.boolean(),
      do_not_email: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.email === "" && v.phone === "" && v.mobile === "") ctx.addIssue({ code: "custom", path: ["email"], message: "Enter an email or a phone number." });
    });

export type ContactForm = {
  first_name: string; last_name: string; title: string; email: string; phone: string; mobile: string; owner_id: string; is_main: boolean; do_not_email: boolean;
};

/** The form's starting values from the contact (or, in a conflict, from what is there now). The owner is the person's id, "" for none; the form's field names are the database's column names, so a conflict can set what was typed beside what is there. */
export const formOf = (c: Pick<ContactFields, "firstName" | "lastName" | "title" | "email" | "phone" | "mobile" | "isMain" | "doNotEmail"> & { ownerId: string | null }): ContactForm => ({
  first_name: c.firstName ?? "", last_name: c.lastName, title: c.title ?? "", email: c.email ?? "", phone: c.phone ?? "", mobile: c.mobile ?? "", owner_id: c.ownerId ?? "",
  is_main: c.isMain, do_not_email: c.doNotEmail,
});

export const formOfContact = (c: ContactFields): ContactForm => formOf({ ...c, ownerId: c.owner?.id ?? null });
export const formOfEditable = (c: ContactEditable): ContactForm => formOf(c);

/** What the form sends: every field, a blank as typed (the database clears it), an owner left empty as "keep". */
export const editOf = (f: ContactForm): ContactEdit => ({
  firstName: f.first_name, lastName: f.last_name, title: f.title, email: f.email, phone: f.phone, mobile: f.mobile, ownerId: f.owner_id === "" ? null : f.owner_id,
  isMain: f.is_main, doNotEmail: f.do_not_email,
});

/** A tick box's value in words. */
export const yesNo = (v: boolean): string => (v ? "Yes" : "No");
