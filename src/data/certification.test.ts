import { describe, expect, it } from "vitest";
import { certificationBlockers, consentStatements } from "./certification";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { requiredItems, type RequiredItem, type RequiredItemState } from "./requiredItems";

// The four items (three required, then the recommended census), in the given states.
const itemsIn = (...states: RequiredItemState[]): RequiredItem[] =>
  requiredItems(EMPTY_CHAMBER_DATA, {}, new Set()).map((i, n) => ({ ...i, state: states[n] }));

const ready = {
  acknowledged: [true, true, true],
  signer: { name: "Jo Doe", title: "CEO" },
  signed: true,
  hasFileId: true,
  isGuest: false,
  requiredItems: itemsIn("settled", "settled", "settled", "settled"),
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

  it("blocks on each required item whose answers conflict, naming it", () => {
    expect(certificationBlockers({ ...ready, requiredItems: itemsIn("conflicting", "settled", "conflicting", "settled") })).toEqual([
      "Resolve the conflicting answers for Company legal name",
      "Resolve the conflicting answers for Pay frequency",
    ]);
  });

  it("never blocks on the recommended census, but names it when its conflict gives the states of operation", () => {
    expect(certificationBlockers({ ...ready, requiredItems: itemsIn("settled", "settled", "settled", "conflicting") })).toEqual([]);
    const items = itemsIn("settled", "conflicting", "settled", "conflicting").map((i) =>
      i.field === "states" ? { ...i, viaCensus: true as const } : i,
    );
    expect(certificationBlockers({ ...ready, requiredItems: items })).toEqual(["Resolve the conflicting answers for Employee census"]);
  });

  it("doesn't block on items that are only incomplete or unconfirmed, nor on missing ones it isn't told about", () => {
    expect(certificationBlockers({ ...ready, requiredItems: itemsIn("missing", "incomplete", "unconfirmed", "missing") })).toEqual([]);
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
