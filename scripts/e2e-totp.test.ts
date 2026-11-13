import { describe, expect, it } from "vitest";
// @ts-expect-error the end-to-end stack is plain JavaScript with no declarations
import { totpCode } from "../e2e/stack/totp.mjs";

describe("the end-to-end stack's authenticator codes", () => {
  it("match RFC 6238's published example", () => {
    // RFC 6238 appendix B: the ASCII key "12345678901234567890" (base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ) at 59 seconds is 94287082; 6 digits keep its last six.
    expect(totpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
  });
});
