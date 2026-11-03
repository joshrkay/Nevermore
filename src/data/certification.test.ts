import { describe, expect, it } from "vitest";
import { certificationBlockers, consentStatements } from "./certification";
import { REQUIRED_ITEMS, type RequiredItem, type RequiredItemState } from "./requiredItems";

const itemsIn = (...states: RequiredItemState[]): RequiredItem[] => REQUIRED_ITEMS.map((i, n) => ({ ...i, state: states[n] }));

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
  ])("blocks on %s", (_label, override, expected) => {
    expect(certificationBlockers({ ...ready, ...override })).toEqual([expected]);
  });

  it("blocks on each required item whose answers conflict, naming it", () => {
    expect(certificationBlockers({ ...ready, requiredItems: itemsIn("conflicting", "settled", "conflicting", "settled") })).toEqual([
      "Resolve the conflicting answers for Company legal name",
      "Resolve the conflicting answers for Pay frequency",
    ]);
  });

  it("names a conflicting census once, when the census alone gives the states of operation", () => {
    const items = itemsIn("settled", "conflicting", "settled", "conflicting").map((i) =>
      i.field === "states" ? { ...i, viaCensus: true as const } : i,
    );
    expect(certificationBlockers({ ...ready, requiredItems: items })).toEqual(["Resolve the conflicting answers for Employee census"]);
  });

  it("doesn't block on required items that are only missing, incomplete or unconfirmed (the full rule is C-1.3's)", () => {
    expect(certificationBlockers({ ...ready, requiredItems: itemsIn("missing", "incomplete", "unconfirmed", "missing") })).toEqual([]);
  });
});

describe("consentStatements", () => {
  it("names the chosen PEO, or stays neutral", () => {
    expect(consentStatements("Acme PEO")[2]).toContain("send to Acme PEO myself");
    expect(consentStatements(null)[2]).toContain("the PEO I choose");
  });
});
