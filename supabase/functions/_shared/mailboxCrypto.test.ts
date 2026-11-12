import { describe, expect, it } from "vitest";
import { openToken, parseTokenKey, sealToken } from "./mailboxCrypto";

const KEY_B64 = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 1)));
const key = parseTokenKey(KEY_B64)!;
const OTHER = parseTokenKey(btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => 200 - i))))!;

describe("the mailbox token key", () => {
  it("is 32 bytes of base64, and nothing else", () => {
    expect(key).toHaveLength(32);
    for (const bad of [undefined, "", "not base64!!", btoa("short"), btoa("x".repeat(33))]) expect(parseTokenKey(bad), String(bad)).toBeNull();
  });
});

describe("sealing a refresh token", () => {
  it("opens with the same key for the same broker", async () => {
    const sealed = await sealToken(key, "user-1", "1//refresh-token-value");
    expect(await openToken(key, "user-1", sealed)).toBe("1//refresh-token-value");
  });

  it("holds no trace of the token, and differs each time", async () => {
    const a = await sealToken(key, "user-1", "1//refresh-token-value");
    const b = await sealToken(key, "user-1", "1//refresh-token-value");
    expect(a.ciphertext).not.toContain("refresh-token-value");
    expect(atob(a.ciphertext)).not.toContain("refresh");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it("does not open with another key, for another broker, or when changed", async () => {
    const sealed = await sealToken(key, "user-1", "secret");
    expect(await openToken(OTHER, "user-1", sealed)).toBeNull();
    expect(await openToken(key, "user-2", sealed)).toBeNull();
    const bytes = Uint8Array.from(atob(sealed.ciphertext), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    expect(await openToken(key, "user-1", { ...sealed, ciphertext: btoa(String.fromCharCode(...bytes)) })).toBeNull();
    expect(await openToken(key, "user-1", { ciphertext: "%%%", iv: "%%%" })).toBeNull();
  });
});
