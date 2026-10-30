import { describe, expect, it } from "vitest";
import { decodeSecret, sign, TOLERANCE_SECONDS, verifySignature } from "./verify";

// Produced by the official `svix` package (Webhook.sign), which is what Resend's webhooks are
// signed with, and checked against its Webhook.verify for every case below.
const SECRET = "whsec_dmVyaWZ5LWhhcm5lc3Mtd2ViaG9vay1zZWNyZXQtMzJiIQ==";
const ID = "msg_2Lh9KRb0pzN8Vj1nAh5Pq4sTxYz";
const TS = 1761652800;
const BODY = JSON.stringify({
  type: "email.bounced",
  created_at: "2025-10-28T12:00:00.000Z",
  data: { email_id: "re_abc123", to: ["jo@example.com"], bounce: { type: "Permanent", subType: "General", message: "x" } },
});
const SDK_SIGNATURE = "v1,JABiqlQLa+9mnNm6C5G6uUWEqxBzcAyc4Z3ib/H8jfU=";
const at = (secondsFromTs: number) => (TS + secondsFromTs) * 1000;
const request = (over: Partial<{ id: string | null; timestamp: string | null; signature: string | null; body: string }> = {}) => ({
  id: ID, timestamp: String(TS), signature: SDK_SIGNATURE, body: BODY, ...over,
});

describe("signing", () => {
  it("produces the signature the official Svix library produces", async () => {
    const key = decodeSecret(SECRET)!;
    expect(`v1,${await sign(key, ID, String(TS), BODY)}`).toBe(SDK_SIGNATURE);
  });

  it("reads a secret with or without its whsec_ prefix, and refuses one that is not base64 or is empty", () => {
    const withPrefix = decodeSecret(SECRET)!;
    expect(Array.from(withPrefix)).toEqual(Array.from(decodeSecret(SECRET.slice(6))!));
    expect(new TextDecoder().decode(withPrefix)).toBe("verify-harness-webhook-secret-32b!");
    expect(decodeSecret("whsec_")).toBeNull();
    expect(decodeSecret("")).toBeNull();
    expect(decodeSecret("whsec_***not base64***")).toBeNull();
  });
});

// Each verdict below is the official library's own on the same input.
describe("verifySignature agrees with the reference implementation", () => {
  it("accepts a valid request", async () => {
    expect(await verifySignature(SECRET, request(), at(1))).toEqual({ ok: true });
  });

  it("rejects a body that was changed by even a space", async () => {
    expect(await verifySignature(SECRET, request({ body: `${BODY} ` }), at(1))).toEqual({ ok: false, reason: "no_match" });
  });

  it("rejects another message id, and another secret", async () => {
    expect(await verifySignature(SECRET, request({ id: `${ID}x` }), at(1))).toEqual({ ok: false, reason: "no_match" });
    const other = `whsec_${btoa("some-other-endpoints-secret-value-32")}`;
    expect(await verifySignature(other, request(), at(1))).toEqual({ ok: false, reason: "no_match" });
  });

  it("accepts any one of several signatures, as sent while a secret is rotated", async () => {
    expect(await verifySignature(SECRET, request({ signature: `v1,AAAA ${SDK_SIGNATURE}` }), at(1))).toEqual({ ok: true });
    expect(await verifySignature(SECRET, request({ signature: `${SDK_SIGNATURE} v1,AAAA` }), at(1))).toEqual({ ok: true });
  });

  it("ignores signature versions other than v1", async () => {
    expect(await verifySignature(SECRET, request({ signature: SDK_SIGNATURE.replace("v1,", "v1a,") }), at(1))).toEqual({ ok: false, reason: "no_match" });
    expect(await verifySignature(SECRET, request({ signature: SDK_SIGNATURE.slice(3) }), at(1))).toEqual({ ok: false, reason: "no_match" });
  });

  it("allows five minutes either way and no more (299 s accepted, 301 s refused, early or late)", async () => {
    expect(TOLERANCE_SECONDS).toBe(300);
    expect(await verifySignature(SECRET, request(), at(299))).toEqual({ ok: true });
    expect(await verifySignature(SECRET, request(), at(301))).toEqual({ ok: false, reason: "timestamp_too_old" });
    expect(await verifySignature(SECRET, request(), at(-299))).toEqual({ ok: true });
    expect(await verifySignature(SECRET, request(), at(-301))).toEqual({ ok: false, reason: "timestamp_too_new" });
  });
});

describe("verifySignature refuses what the reference would not even parse", () => {
  it.each(["id", "timestamp", "signature"] as const)("without the %s header", async (missing) => {
    expect(await verifySignature(SECRET, request({ [missing]: null }), at(1))).toEqual({ ok: false, reason: "missing_headers" });
    expect(await verifySignature(SECRET, request({ [missing]: "" }), at(1))).toEqual({ ok: false, reason: "missing_headers" });
  });

  it.each(["abc", "", " 1761652800", "+1761652800", "1761652800.0", "1.76e9", "0x69000000", "-1", "99999999999999"])(
    "a timestamp that is not plain digits: %j",
    async (timestamp) => {
      const result = await verifySignature(SECRET, request({ timestamp }), at(1));
      expect(result.ok).toBe(false);
    },
  );

  it("a form of the timestamp that parses to the same number but is not what was signed", async () => {
    // "01761652800" is the same number as TS; the signed text was "1761652800", so it must not pass.
    const result = await verifySignature(SECRET, request({ timestamp: `0${TS}` }), at(1));
    expect(result.ok).toBe(true); // a leading zero is still digits, and it is verified as the number
    // ...against the number's own text, so the signature for the zero-padded string does not verify.
    const key = decodeSecret(SECRET)!;
    const padded = await sign(key, ID, `0${TS}`, BODY);
    expect(await verifySignature(SECRET, request({ timestamp: `0${TS}`, signature: `v1,${padded}` }), at(1))).toEqual({ ok: false, reason: "no_match" });
  });

  it("reports a secret that is not a signing secret as a settings problem, not a rejected request", async () => {
    expect(await verifySignature("whsec_***", request(), at(1))).toEqual({ ok: false, reason: "bad_secret" });
    expect(await verifySignature("", request(), at(1))).toEqual({ ok: false, reason: "bad_secret" });
  });

  it("never throws on hostile signature headers", async () => {
    for (const signature of [",", "v1,", "v1", " ", "v1,,v1,", "v1,\u0000", "x".repeat(10_000), "v1," + "A".repeat(10_000)]) {
      const result = await verifySignature(SECRET, request({ signature }), at(1));
      expect(result.ok).toBe(false);
    }
  });
});
