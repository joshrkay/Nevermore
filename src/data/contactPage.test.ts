import { describe, expect, it } from "vitest";
import { contactEditSchemaFor, editOf, formOf, formOfContact } from "./contactPage";

const none = { email: null, phone: null, mobile: null };
const ok = { first_name: "Elena", last_name: "Marsh", title: "", email: "elena@harborview.example", phone: "", mobile: "", owner_id: "u1", is_main: false, do_not_email: false };

describe("a contact's edit form", () => {
  // Catches: the form taking what the database refuses (a last name of spaces, no way to reach them).
  it("needs a last name and an email, a phone or a mobile", () => {
    const schema = contactEditSchemaFor(none);
    expect(schema.safeParse(ok).success).toBe(true);
    expect(schema.safeParse({ ...ok, last_name: "   " }).success).toBe(false);
    expect(schema.safeParse({ ...ok, email: "", phone: "", mobile: "" }).success).toBe(false);
    expect(schema.safeParse({ ...ok, email: "", mobile: "(503) 555-0199" }).success).toBe(true);
  });
  // Catches: an older-format value blocking a save of another field, compared untrimmed, or a changed one let through.
  it("judges an email, a phone or a mobile only when it was changed", () => {
    const schema = contactEditSchemaFor({ email: "pat@harborview", phone: " 555 ", mobile: "ask for Pat" });
    expect(schema.safeParse({ ...ok, email: "pat@harborview", phone: "555", mobile: "ask for Pat" }).success).toBe(true);
    expect(schema.safeParse({ ...ok, email: "pat@harborview.", phone: "555", mobile: "ask for Pat" }).success).toBe(false);
    expect(schema.safeParse({ ...ok, email: "pat@harborview", phone: "5551", mobile: "ask for Pat" }).success).toBe(false);
    expect(schema.safeParse({ ...ok, email: "pat@harborview", phone: "555", mobile: "ask for Sam" }).success).toBe(false);
  });
  it("starts from the contact and sends an owner left empty as 'keep'", () => {
    const form = formOf({ firstName: null, lastName: "Marsh", title: null, email: "e@x.co", phone: null, mobile: null, isMain: true, doNotEmail: true, ownerId: null });
    expect(form).toEqual({ first_name: "", last_name: "Marsh", title: "", email: "e@x.co", phone: "", mobile: "", owner_id: "", is_main: true, do_not_email: true });
    expect(editOf(form)).toMatchObject({ ownerId: null, isMain: true, doNotEmail: true });
    expect(editOf({ ...form, owner_id: "u1" })).toMatchObject({ ownerId: "u1" });
    expect(formOfContact({ id: "c", version: 1, accountId: "a", firstName: "E", lastName: "M", title: null, email: null, phone: "(503) 555-0142", mobile: null, isMain: false, doNotEmail: false, owner: { id: "u9", name: "N" }, createdAt: "", updatedAt: "" }).owner_id).toBe("u9");
  });
});
