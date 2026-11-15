import { z } from "zod";
import { nameRule, optionalEmailRule, phoneRule } from "@/components/workspace/form/fieldRules";

// The rules of a contact's own fields as the Add a contact form applies them (story CRM-A2.2, screen 24). The database asks the same rules (contact_input_error,
// 20261119170000), so a form that takes a value is a form the database takes. A contact needs a last name and an email or a phone; a mobile number is a phone.

const short = z.string().trim().max(100, "Use 100 characters or fewer.");

export const contactFieldsSchema = z
  .object({
    first_name: short,
    last_name: nameRule("Enter the contact's last name.", 100),
    title: short,
    email: optionalEmailRule(),
    phone: phoneRule(),
    mobile: phoneRule(),
  })
  .superRefine((v, ctx) => {
    if (v.email === "" && v.phone === "" && v.mobile === "") ctx.addIssue({ code: "custom", path: ["email"], message: "Enter an email or a phone number." });
  });
