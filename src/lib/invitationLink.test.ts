import { beforeEach, describe, expect, it } from "vitest";
import { forgetInvitationToken, JOIN_PATH, takeInvitationToken } from "./invitationLink";

const open = (url: string) => window.history.replaceState(null, "", url);

// The secret of an invitation's link is in the part after the #, which a browser never sends to a server (D-34). The page reads it,
// takes it out of the address bar at once, and keeps it only in this tab until the person has signed in and joined.
describe("takeInvitationToken", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    open("/");
  });

  it("is where the link opens: a path with no secret in it", () => {
    expect(JOIN_PATH).toBe("/join");
  });

  it("reads the token from the fragment and removes it from the address bar, keeping the path and query", () => {
    open("/join?x=1#token=abc-DEF_123");
    expect(takeInvitationToken()).toBe("abc-DEF_123");
    expect(window.location.hash).toBe("");
    expect(window.location.pathname + window.location.search).toBe("/join?x=1");
    expect(window.location.href).not.toContain("abc-DEF_123");
  });

  it("still has the token after the person signs in and comes back to the page without it", () => {
    open("/join#token=abc");
    takeInvitationToken();
    open("/join");
    expect(takeInvitationToken()).toBe("abc");
  });

  it("takes the new link's token over an earlier one's", () => {
    open("/join#token=old");
    takeInvitationToken();
    open("/join#token=new");
    expect(takeInvitationToken()).toBe("new");
    open("/join");
    expect(takeInvitationToken()).toBe("new");
  });

  it("has none when the page is opened with none", () => {
    open("/join");
    expect(takeInvitationToken()).toBe("");
    open("/join#section");
    expect(takeInvitationToken()).toBe("");
  });

  it("forgets it once the person has joined", () => {
    open("/join#token=abc");
    takeInvitationToken();
    forgetInvitationToken();
    open("/join");
    expect(takeInvitationToken()).toBe("");
  });

  it("works without browser storage (a private window), for as long as the page keeps it", () => {
    const real = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("blocked"); }, configurable: true });
    try {
      open("/join#token=abc");
      expect(takeInvitationToken()).toBe("abc");
      expect(window.location.hash).toBe("");
      open("/join");
      expect(takeInvitationToken()).toBe("");
      expect(() => forgetInvitationToken()).not.toThrow();
    } finally {
      Object.defineProperty(window, "sessionStorage", real);
    }
  });
});
