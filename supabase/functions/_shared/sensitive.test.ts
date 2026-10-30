import { describe, expect, it } from "vitest";
import { hasSensitive, isSensitiveHeader, REDACTED, redactSensitive } from "./sensitive.ts";

describe("redactSensitive", () => {
  it("removes formatted and unformatted Social Security numbers", () => {
    expect(redactSensitive("SSN 123-45-6789 on file")).toBe(`SSN ${REDACTED} on file`);
    expect(redactSensitive("123 45 6789")).toBe(REDACTED);
    expect(redactSensitive("id 123456789.")).toBe(`id ${REDACTED}.`);
  });

  it("removes labelled account and routing numbers, keeping the label", () => {
    expect(redactSensitive("Acct # 00123456 at Chase")).toBe(`Acct ${REDACTED} at Chase`);
    expect(redactSensitive("routing: 021000021")).toBe(`routing ${REDACTED}`);
    expect(redactSensitive("account number 4455-6677")).toBe(`account ${REDACTED}`);
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
