import { describe, expect, it } from "vitest";
import { certificationBlockers, consentStatements, type NeededAnswer } from "./certification";

const ready = {
  acknowledged: [true, true, true],
  signer: { name: "Jo Doe", title: "CEO" },
  signed: true,
  hasIntake: true,
  isGuest: false,
};

const missing = (label: string): NeededAnswer => ({ label, reason: "missing" });
const conflicting = (label: string): NeededAnswer => ({ label, reason: "conflicting" });

describe("certificationBlockers", () => {
  it("is empty when certification is complete", () => {
    expect(certificationBlockers(ready)).toEqual([]);
    expect(certificationBlockers({ ...ready, needed: [] })).toEqual([]);
  });

  it.each([
    ["a guest", { isGuest: true }, "Verify your email"],
    ["an unsaved session", { hasIntake: false }, "Wait for your intake to finish saving"],
    ["an unchecked statement", { acknowledged: [true, false, true] }, "Check every statement"],
    ["a blank name", { signer: { name: "  ", title: "CEO" } }, "Enter your full name"],
    ["a blank role", { signer: { name: "Jo", title: " " } }, "Enter your role"],
    ["no signature", { signed: false }, "Sign"],
    ["a missing required answer", { needed: [missing("Pay frequency")] }, "Add pay frequency"],
    ["a required answer given two ways", { needed: [conflicting("Company legal name")] }, "Choose one answer for company legal name"],
  ])("blocks on %s", (_label, override, expected) => {
    expect(certificationBlockers({ ...ready, ...override })).toEqual([expected]);
  });

  it("blocks on each required answer whose answers conflict, naming it", () => {
    expect(certificationBlockers({ ...ready, needed: [conflicting("Company legal name"), conflicting("Pay frequency")] })).toEqual([
      "Choose one answer for company legal name",
      "Choose one answer for pay frequency",
    ]);
  });

  // readiness.ts names the census when its conflict is what gives the states of operation.
  it("names whatever answer readiness says needs settling", () => {
    expect(certificationBlockers({ ...ready, needed: [conflicting("Employee census")] })).toEqual(["Choose one answer for employee census"]);
  });

  it("puts what the intake still needs before what the signer has to do", () => {
    expect(certificationBlockers({ ...ready, signed: false, needed: [missing("Company legal name"), missing("States of operation")] })).toEqual([
      "Add company legal name",
      "Add states of operation",
      "Sign",
    ]);
  });

  it("names missing answers, then conflicts, then the signer's steps", () => {
    expect(certificationBlockers({ ...ready, signed: false, needed: [missing("Pay frequency"), conflicting("Company legal name")] })).toEqual([
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
