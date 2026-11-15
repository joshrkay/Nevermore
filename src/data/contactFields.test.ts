import { describe, expect, it } from "vitest";
import { contactFieldsSchema } from "./contactFields";

const ok = { first_name: "Owen", last_name: "Park", title: "Owner", email: "owen@harborview.example", phone: "", mobile: "" };
const issues = (v: unknown) => {
  const r = contactFieldsSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("contactFieldsSchema", () => {
  // Catches: a contact with no last name saved (the screen marks it Required).
  it("requires a last name, in words, and trims it", () => {
    expect(issues({ ...ok, last_name: "  " })).toEqual(["last_name: Enter the contact's last name."]);
    expect(contactFieldsSchema.parse({ ...ok, last_name: " Park " }).last_name).toBe("Park");
  });
  // Catches: the story's "an email or a phone is required" dropped, or said under the wrong field.
  it("requires an email or a phone, and a mobile counts as a phone", () => {
    expect(issues({ ...ok, email: "" })).toEqual(["email: Enter an email or a phone number."]);
    expect(issues({ ...ok, email: "", phone: "(503) 555-0140" })).toEqual([]);
    expect(issues({ ...ok, email: "", mobile: "503 555 0141" })).toEqual([]);
    expect(issues({ ...ok, email: "   ", phone: " " })).toEqual(["email: Enter an email or a phone number."]);
  });
  // Catches: an email that is not one, or a phone that breaks the repository's rule, accepted by the form and then refused by the database.
  it("checks the email and the phone numbers by the shared rules", () => {
    expect(issues({ ...ok, email: "not an email" })).toEqual(["email: Enter an email address like name@example.com."]);
    expect(issues({ ...ok, phone: "12345" })).toEqual(["phone: Enter a phone number like (503) 555-0142. An extension can follow, like x12."]);
    expect(issues({ ...ok, mobile: "call me" })).toEqual(["mobile: Enter a phone number like (503) 555-0142. An extension can follow, like x12."]);
    expect(issues({ ...ok, phone: "(503) 555-0140 x12" })).toEqual([]);
  });
  // Catches: lengths the database refuses reaching it.
  it("keeps the names and the title to 100 characters", () => {
    expect(issues({ ...ok, first_name: "a".repeat(101) })).toEqual(["first_name: Use 100 characters or fewer."]);
    expect(issues({ ...ok, last_name: "a".repeat(101) })).toEqual(["last_name: Use 100 characters or fewer."]);
    expect(issues({ ...ok, title: "a".repeat(101) })).toEqual(["title: Use 100 characters or fewer."]);
  });
});
