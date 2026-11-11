import { describe, expect, it } from "vitest";
import { hasSensitive, isSensitiveHeader, REDACTED, redactSensitive, redactForModel } from "./sensitive.ts";

describe("redactSensitive", () => {
  it("removes formatted and unformatted Social Security numbers", () => {
    expect(redactSensitive("SSN 123-45-6789 on file")).toBe(`SSN ${REDACTED} on file`);
    expect(redactSensitive("123 45 6789")).toBe(REDACTED);
    expect(redactSensitive("id 123456789.")).toBe(`id ${REDACTED}.`);
  });

  it("removes an SSN written with dots", () => {
    expect(redactSensitive("SSN 123.45.6789 on file")).toBe(`SSN ${REDACTED} on file`);
  });

  it("removes an SSN written with en or em dashes, as a word processor or phone keyboard types them", () => {
    expect(redactSensitive("123–45–6789")).toBe(REDACTED);
    expect(redactSensitive("123—45—6789")).toBe(REDACTED);
  });

  it("removes an SSN typed straight after its label, keeping the label", () => {
    expect(redactSensitive("my ssn123456789")).toBe(`my ssn${REDACTED}`);
    expect(redactSensitive("SSN123-45-6789")).toBe(`SSN${REDACTED}`);
    expect(redactSensitive("SSN#123-45-6789")).toBe(`SSN#${REDACTED}`);
  });

  it("removes an SSN glued to its label by an underscore, or to a longer or shorter label", () => {
    expect(redactSensitive("SSN_123-45-6789")).toBe(`SSN_${REDACTED}`);
    expect(redactSensitive("ssn_123456789")).toBe(`ssn_${REDACTED}`);
    expect(redactSensitive("myssn123456789")).toBe(`myssn${REDACTED}`);
    expect(redactSensitive("SS123-45-6789")).toBe(`SS${REDACTED}`);
    expect(redactSensitive("ssn123.45.6789")).toBe(`ssn${REDACTED}`);
  });

  it("removes labelled account and routing numbers, keeping the label", () => {
    expect(redactSensitive("Acct # 00123456 at Chase")).toBe(`Acct ${REDACTED} at Chase`);
    expect(redactSensitive("routing: 021000021")).toBe(`routing ${REDACTED}`);
    expect(redactSensitive("account number 4455-6677")).toBe(`account ${REDACTED}`);
    // However much space a PDF's layout leaves between the label and the number.
    expect(redactSensitive("Account Number:            0012345")).toBe(`Account ${REDACTED}`);
    expect(redactSensitive("acct #   :   0012345")).toBe(`acct ${REDACTED}`);
    expect(redactSensitive("routing\n021000021")).toBe(`routing ${REDACTED}`);
  });

  it("takes time in proportion to the text, however much space follows a label", () => {
    // Back-to-back optional spaces once made this quadratic: 64,000 spaces took about 1.5 s.
    for (const text of ["account" + " ".repeat(200_000) + "x", ("account" + " ".repeat(60) + "x ").repeat(3_000), "acct #" + " ".repeat(200_000)]) {
      const started = performance.now();
      redactSensitive(text);
      expect(performance.now() - started).toBeLessThan(500);
    }
  });

  it("removes a card number written in groups of four", () => {
    expect(redactSensitive("card 4111 1111 1111 1111 exp 09/27")).toBe(`card ${REDACTED} exp 09/27`);
    expect(redactSensitive("4111-1111-1111-1111")).toBe(REDACTED);
  });

  it("removes a card number of 13 to 19 digits whose last group is short or long", () => {
    expect(redactSensitive("4222 2222 2222 2")).toBe(REDACTED);
    expect(redactSensitive("6011 0009 9013 9424 124")).toBe(REDACTED);
    expect(redactSensitive("6011-0009-9013-9424124")).toBe(REDACTED);
  });

  it("removes a card number of 16 digits with its security code typed after it", () => {
    expect(redactSensitive("card 4111 1111 1111 1111 123")).toBe(`card ${REDACTED}`);
  });

  it("removes a card number that follows another group of four digits", () => {
    // A document's table cells are joined with spaces, so an ID, year or expiry cell can sit just before a card.
    expect(redactSensitive("1042 4111 1111 1111 1111")).toBe(`1042 ${REDACTED}`);
    expect(redactSensitive("Exp 0927 4111-1111-1111-1111")).toBe(`Exp 0927 ${REDACTED}`);
    expect(redactSensitive("Year 2024 5500 0000 0000 0004")).toBe(`Year 2024 ${REDACTED}`);
    expect(redactSensitive("ID 2024 2025 3782 822463 10005")).toBe(`ID 2024 2025 ${REDACTED}`);
  });

  it("removes an American Express number, grouped four, six, five", () => {
    expect(redactSensitive("Amex 3782 822463 10005")).toBe(`Amex ${REDACTED}`);
    expect(redactSensitive("3782-822463-10005")).toBe(REDACTED);
  });

  it("removes long digit runs that could be account numbers", () => {
    expect(redactSensitive("pay to 000123456789012")).toBe(`pay to ${REDACTED}`);
  });

  it("leaves ordinary intake text alone", () => {
    for (const text of [
      "About 40 employees in CA and TX",
      "Renewal on 06/01/2026, up 12%",
      "Blue Shield PPO 500",
      "Call 555-123-4567",
      "ZIP 94107-1234",
      "Payroll of $1,250,000 a year",
      "We have 2 accounts",
      // An EIN is the company's, not a person's, so a stored answer may hold one (a policy number can share its
      // shape). What goes to the model is stricter: see redactForModel below.
      "12-3456789",
      "EIN 12-3456789",
      "(555) 123-4567",
      "555-123-4567",
      "+1 555 123 4567",
      "salary $85,000",
      "payroll 1,250,000",
      "DOB 01/02/1985",
      // Amounts with cents next to other numbers, as a rate sheet's table reads once its cells are joined.
      "EE 512.40 1124.80 1637.20",
      "hourly rate 125.50 2080 hours",
      "Premiums 450.00–1200.00 per month",
      // Four groups of four digits that aren't a card: years, plan years, hours.
      "Rates for 2021 2022 2023 2024: 5%, 7%, 3%, 9%",
      "Plan years 2022-2023 2023-2024 increases 6% and 9%",
      "Office hours 0800-1700 0900-1300",
      // These pass the check digit, but no card number starts like a year.
      "Renewals 2023 2024 2025 2026: +4%, +6%, +8%",
      "Plan years 2021-2022 2022-2023",
      "class codes 8810 8742 5183 9015",
      // These start like a card but fail its check digit.
      "class codes 5183 5403 5645 5606",
      "Policy 3400 120556 00012",
    ]) {
      expect(redactSensitive(text)).toBe(text);
      expect(hasSensitive(text)).toBe(false);
    }
  });
});

describe("isSensitiveHeader", () => {
  it("recognises SSN and bank columns", () => {
    for (const h of ["ssn", "social security number", "tax id", "bank account number", "routing number", "direct deposit account"]) {
      expect(isSensitiveHeader(h)).toBe(true);
    }
  });

  it("does not flag census columns", () => {
    for (const h of ["first name", "dob", "work state", "salary", "class code", "accrual"]) {
      expect(isSensitiveHeader(h)).toBe(false);
    }
  });
});

// ADR 0006: the FEIN is typed into its own box in the workspace, so one written in a chat message or a document is
// removed before the text reaches the model or the transcript. Stored answers keep redactSensitive's rules.
describe("redactForModel", () => {
  it("removes a FEIN written the way a FEIN is written, two digits, a hyphen and seven", () => {
    expect(redactForModel("Our EIN is 84-1234567, thanks")).toBe("Our EIN is [redacted], thanks");
    expect(redactForModel("FEIN: 84-1234567")).toBe("FEIN: [redacted]");
    expect(redactForModel("84–1234567")).toBe("[redacted]");
  });

  it("leaves numbers that only look a little like a FEIN", () => {
    for (const text of ["500 Main St, Austin, TX 78701-1234", "Order 2024-1234567", "call 512-555-0142", "policy 84-123456", "plan years 24-25", "ratio 12-34567890"]) {
      expect(redactForModel(text), text).toBe(text);
    }
  });

  it("removes everything redactSensitive removes", () => {
    expect(redactForModel("SSN 123-45-6789 and EIN 84-1234567")).toBe("SSN [redacted] and EIN [redacted]");
  });

  it("is not applied to a stored answer: a policy number shaped like a FEIN is kept", () => {
    expect(redactSensitive("Pinnacle, policy 07-1234567")).toBe("Pinnacle, policy 07-1234567");
  });
});
