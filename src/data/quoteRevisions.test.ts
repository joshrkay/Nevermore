import { describe, expect, it } from "vitest";
import { quoteRevisions } from "./quoteRevisions";

const quote = (id: number, over: Partial<{ quote_request_id: number; received_on: string | null }> = {}) => ({ id, quote_request_id: 7, received_on: null, ...over });

describe("a quote request's revised quotes (N-2.4)", () => {
  // Catches: the first quote staying "current" after the PEO revised it, or a revision replacing the earlier quote instead of sitting beside it.
  it("makes the newest recorded quote current and lists every earlier one as superseded, newest first", () => {
    const { current, superseded } = quoteRevisions([quote(1), quote(3), quote(2)]);
    expect(current?.id).toBe(3);
    expect(superseded.map((q) => q.id)).toEqual([2, 1]);
  });
});
