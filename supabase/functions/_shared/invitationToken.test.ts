import { describe, expect, it } from "vitest";
import { hashInvitationToken, newInvitationToken } from "./invitationToken";

describe("an invitation's token", () => {
  it("is hashed with SHA-256 into lower-case hex, the way the database's tests hash one", async () => {
    // The published test vector for SHA-256("abc").
    expect(await hashInvitationToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is new each time, long enough to be unguessable, safe in a link, and comes with its own hash", async () => {
    const a = await newInvitationToken();
    const b = await newInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.hash).toBe(await hashInvitationToken(a.token));
    expect(a.hash).not.toContain(a.token);
  });
});
