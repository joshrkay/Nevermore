import { describe, expect, it } from "vitest";
import { CARRIER_SEND_NOTICE, PEO_SEND_NOTICE } from "@/data/legalWording";
import { peoSendBlockPreview } from "./peoSend";

describe("peoSendBlockPreview (M-2.1; ADR 0029)", () => {
  const block = { fileId: "EAA-2026-0101", version: 2, openItems: [] };

  // The database writes the fixed block (attach_peo_link) and ends it with the notice of the intake's line; the composer previews it line for line.
  // Catches: the advisor shown that a message to a carrier will say it is "for this PEO alone", when the email says "for this carrier alone" (or the reverse).
  it("ends with the line the email will carry: the carrier's on a workers' comp search, the PEO's otherwise", () => {
    expect(peoSendBlockPreview({ ...block, line: "workers_comp" }).at(-1)).toBe(CARRIER_SEND_NOTICE);
    expect(peoSendBlockPreview({ ...block, line: "peo" }).at(-1)).toBe(PEO_SEND_NOTICE);
    expect(peoSendBlockPreview(block).at(-1)).toBe(PEO_SEND_NOTICE);
  });
});
