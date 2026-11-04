import { describe, expect, it } from "vitest";
import {
  APPROVED_CONSENT_VERSIONS,
  CONSENT_IS_DRAFT,
  CONSENT_TEXT_VERSION,
  certificationBlockers,
  consentStatements,
  isDraftConsent,
} from "./certification";

describe("isDraftConsent", () => {
  it("treats the wording signed today as a draft until counsel approves its version", () => {
    expect(APPROVED_CONSENT_VERSIONS).not.toContain(CONSENT_TEXT_VERSION);
    expect(CONSENT_IS_DRAFT).toBe(true);
    expect(isDraftConsent(CONSENT_TEXT_VERSION)).toBe(true);
  });

  it("is not a draft once its version is approved, and every other version still is", () => {
    const approved = ["2027-01-v1"];
    expect(isDraftConsent("2027-01-v1", approved)).toBe(false);
    expect(isDraftConsent("2026-10-draft-1", approved)).toBe(true);
  });

  it("treats a certification that recorded no version as a draft", () => {
    for (const version of [undefined, null, ""]) expect(isDraftConsent(version, ["2027-01-v1"])).toBe(true);
  });
});

const ready = {
  acknowledged: [true, true, true],
  signer: { name: "Jo Doe", title: "CEO" },
  signed: true,
  hasIntake: true,
  isGuest: false,
};

describe("certificationBlockers", () => {
  it("is empty when certification is complete", () => {
    expect(certificationBlockers(ready)).toEqual([]);
  });

  it.each([
    ["a guest", { isGuest: true }, "Verify your email"],
    ["an unsaved session", { hasIntake: false }, "Wait for your intake to finish saving"],
    ["an unchecked statement", { acknowledged: [true, false, true] }, "Check every statement"],
    ["a blank name", { signer: { name: "  ", title: "CEO" } }, "Enter your full name"],
    ["a blank role", { signer: { name: "Jo", title: " " } }, "Enter your role"],
    ["no signature", { signed: false }, "Sign"],
    ["a missing required answer", { missingAnswers: ["Pay frequency"] }, "Add pay frequency"],
    ["a required answer in conflict", { conflictingAnswers: ["Company legal name"] }, "Choose one answer for company legal name"],
  ])("blocks on %s", (_label, override, expected) => {
    expect(certificationBlockers({ ...ready, ...override })).toEqual([expected]);
  });

  it("puts what the intake still needs before what the signer has to do", () => {
    expect(certificationBlockers({ ...ready, signed: false, missingAnswers: ["Company legal name", "States of operation"] })).toEqual([
      "Add company legal name",
      "Add states of operation",
      "Sign",
    ]);
  });

  it("names missing answers, then conflicts, then the signer's steps", () => {
    expect(certificationBlockers({ ...ready, signed: false, missingAnswers: ["Pay frequency"], conflictingAnswers: ["Company legal name"] })).toEqual([
      "Add pay frequency",
      "Choose one answer for company legal name",
      "Sign",
    ]);
  });
});

describe("consentStatements", () => {
  it("names the chosen PEO, or stays neutral", () => {
    expect(consentStatements("Acme PEO")[2]).toContain("send to Acme PEO myself");
    expect(consentStatements(null)[2]).toContain("the PEO I choose");
  });
});
