import { describe, expect, it } from "vitest";
import { bearerToken, isServiceCall, sameSecret } from "./auth";

describe("bearerToken", () => {
  it("reads a bearer token", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("bearer abc")).toBe("abc");
  });
  it("rejects anything else", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
  });
});

describe("sameSecret", () => {
  it("matches only identical secrets", () => {
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abc", "abd")).toBe(false);
    expect(sameSecret("abc", "abcd")).toBe(false);
    expect(sameSecret("", "a")).toBe(false);
  });
});

describe("isServiceCall", () => {
  it("accepts the service-role key and nothing else", () => {
    expect(isServiceCall("Bearer service-key", "service-key")).toBe(true);
    expect(isServiceCall("Bearer anon-key", "service-key")).toBe(false);
    expect(isServiceCall(null, "service-key")).toBe(false);
  });
  it("never treats a missing server key as a match", () => {
    expect(isServiceCall("Bearer ", "")).toBe(false);
    expect(isServiceCall("Bearer x", "")).toBe(false);
  });
});
