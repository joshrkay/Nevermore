import { describe, expect, it } from "vitest";
import { certificationBlockers, consentStatements } from "./certification";

const ready = {
  acknowledged: [true, true, true],
  signer: { name: "Jo Doe", title: "CEO" },
  signed: true,
  hasFileId: true,
  isGuest: false,
};

describe("certificationBlockers", () => {
  it("is empty when certification is complete", () => {
    expect(certificationBlockers(ready)).toEqual([]);
  });

  it.each([
    ["a guest", { isGuest: true }, "Verify your email"],
    ["an unsaved session", { hasFileId: false }, "Wait for your intake to finish saving"],
    ["an unchecked statement", { acknowledged: [true, false, true] }, "Check every statement"],
    ["a blank name", { signer: { name: "  ", title: "CEO" } }, "Enter your full name"],
    ["a blank role", { signer: { name: "Jo", title: " " } }, "Enter your role"],
    ["no signature", { signed: false }, "Sign"],
    ["a missing required answer", { missingAnswers: ["Pay frequency"] }, "Add pay frequency"],
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
});

describe("consentStatements", () => {
  it("names the chosen PEO, or stays neutral", () => {
    expect(consentStatements("Acme PEO")[2]).toContain("send to Acme PEO myself");
    expect(consentStatements(null)[2]).toContain("the PEO I choose");
  });
});
