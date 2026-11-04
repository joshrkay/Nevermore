import { describe, expect, it } from "vitest";
import { certificationBlockers, consentStatements } from "./certification";

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
    ["a missing required answer", { needed: [{ label: "Pay frequency", reason: "missing" as const }] }, "Add pay frequency"],
    ["a required answer with two answers", { needed: [{ label: "Company legal name", reason: "conflicting" as const }] }, "Choose the right company legal name"],
    ["a required answer only partly given", { needed: [{ label: "States of operation", reason: "incomplete" as const }] }, "Complete states of operation"],
  ])("blocks on %s", (_label, override, expected) => {
    expect(certificationBlockers({ ...ready, ...override })).toEqual([expected]);
  });

  it("puts what the intake still needs before what the signer has to do", () => {
    expect(certificationBlockers({ ...ready, signed: false, needed: [{ label: "Company legal name", reason: "missing" }, { label: "States of operation", reason: "missing" }] })).toEqual([
      "Add company legal name",
      "Add states of operation",
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
