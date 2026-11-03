import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

let currentSession: { user: { id: string; is_anonymous?: boolean } } | null = null;
type AuthListener = (event: string, session: { user: { id: string; is_anonymous?: boolean } } | null) => void;
let listener: AuthListener | null = null;
const authApi = {
  onAuthStateChange: vi.fn((cb: AuthListener) => {
    listener = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  }),
  signOut: vi.fn(async () => ({ error: null })),
  getSession: vi.fn(async () => ({ data: { session: currentSession } })),
  signInAnonymously: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOtp: vi.fn(),
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: authApi } }));

const { AuthProvider, useAuth } = await import("./useAuth");
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const mountAuth = async () => {
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe("useAuth guest accounts", () => {
  beforeEach(() => {
    currentSession = null;
    authApi.signInAnonymously.mockReset().mockResolvedValue({ error: null });
    authApi.updateUser.mockReset().mockResolvedValue({ error: null });
    authApi.verifyOtp.mockReset().mockResolvedValue({ error: null });
  });

  it("starts an anonymous guest session", async () => {
    const { result } = await mountAuth();
    let outcome: { error: Error | null } | undefined;
    await act(async () => { outcome = await result.current.signInAnonymously(); });
    expect(authApi.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(outcome?.error).toBeNull();
  });

  it("passes the CAPTCHA token to Supabase when a guest session is requested", async () => {
    const { result } = await mountAuth();
    await act(async () => { await result.current.signInAnonymously("turnstile-token"); });
    expect(authApi.signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: "turnstile-token" } });
  });

  it("asks for a guest session without a CAPTCHA option when there is no token", async () => {
    const { result } = await mountAuth();
    await act(async () => { await result.current.signInAnonymously(); });
    expect(authApi.signInAnonymously).toHaveBeenCalledWith(undefined);
  });

  it("reports whether the current user is still a guest", async () => {
    currentSession = { user: { id: "g1", is_anonymous: true } };
    const guest = await mountAuth();
    expect(guest.result.current.isAnonymous).toBe(true);

    currentSession = { user: { id: "a1", is_anonymous: false } };
    const account = await mountAuth();
    expect(account.result.current.isAnonymous).toBe(false);
  });

  it("sends a verification code by attaching the email to the guest, not creating a second user", async () => {
    const { result } = await mountAuth();
    let outcome: { error: Error | null; emailInUse: boolean } | undefined;
    await act(async () => { outcome = await result.current.requestEmailCode("jo@acme.com"); });
    expect(authApi.updateUser).toHaveBeenCalledWith({ email: "jo@acme.com" }, { emailRedirectTo: `${window.location.origin}/auth/callback` });
    expect(outcome).toEqual({ error: null, emailInUse: false });
  });

  it("says so when the email already belongs to an account", async () => {
    authApi.updateUser.mockResolvedValue({ error: Object.assign(new Error("A user with this email address has already been registered"), { code: "email_exists" }) });
    const { result } = await mountAuth();
    let outcome: { error: Error | null; emailInUse: boolean } | undefined;
    await act(async () => { outcome = await result.current.requestEmailCode("jo@acme.com"); });
    expect(outcome?.emailInUse).toBe(true);
    expect(outcome?.error).not.toBeNull();
  });

  it("confirms the code as an email change, which upgrades the guest in place", async () => {
    const { result } = await mountAuth();
    let outcome: { error: Error | null } | undefined;
    await act(async () => { outcome = await result.current.verifyEmailCode("jo@acme.com", "123456"); });
    expect(authApi.verifyOtp).toHaveBeenCalledWith({ email: "jo@acme.com", token: "123456", type: "email_change" });
    expect(outcome?.error).toBeNull();
  });

  it("returns the error when the code is wrong", async () => {
    authApi.verifyOtp.mockResolvedValue({ error: new Error("Token has expired or is invalid") });
    const { result } = await mountAuth();
    let outcome: { error: Error | null } | undefined;
    await act(async () => { outcome = await result.current.verifyEmailCode("jo@acme.com", "000000"); });
    expect(outcome?.error?.message).toMatch(/expired or is invalid/);
  });
});

describe("useAuth returning by emailed code", () => {
  beforeEach(() => {
    currentSession = { user: { id: "g1", is_anonymous: true } };
    authApi.signInWithOtp.mockReset().mockResolvedValue({ error: null });
    authApi.verifyOtp.mockReset().mockResolvedValue({ error: null });
  });

  it("emails a code to an existing account only, never creating one", async () => {
    const { result } = await mountAuth();
    let outcome: { error: Error | null; noAccount: boolean } | undefined;
    await act(async () => { outcome = await result.current.requestSignInCode("jo@acme.com"); });
    expect(authApi.signInWithOtp).toHaveBeenCalledWith({ email: "jo@acme.com", options: { shouldCreateUser: false } });
    expect(outcome).toEqual({ error: null, noAccount: false });
  });

  it("tells the caller there is no account, without calling it an error", async () => {
    authApi.signInWithOtp.mockResolvedValue({ error: Object.assign(new Error("Signups not allowed for otp"), { code: "otp_disabled" }) });
    const { result } = await mountAuth();
    let outcome: { error: Error | null; noAccount: boolean } | undefined;
    await act(async () => { outcome = await result.current.requestSignInCode("nobody@acme.com"); });
    expect(outcome).toEqual({ error: null, noAccount: true });
  });

  it("passes other failures on, such as too many requests", async () => {
    authApi.signInWithOtp.mockResolvedValue({ error: Object.assign(new Error("For security purposes, you can only request this after 60 seconds"), { code: "over_email_send_rate_limit" }) });
    const { result } = await mountAuth();
    let outcome: { error: Error | null; noAccount: boolean } | undefined;
    await act(async () => { outcome = await result.current.requestSignInCode("jo@acme.com"); });
    expect(outcome?.noAccount).toBe(false);
    expect(outcome?.error?.message).toMatch(/60 seconds/);
  });

  it("signs in with the code as an email sign-in, not an email change", async () => {
    const { result } = await mountAuth();
    await act(async () => { await result.current.verifySignInCode("jo@acme.com", "654321"); });
    expect(authApi.verifyOtp).toHaveBeenCalledWith({ email: "jo@acme.com", token: "654321", type: "email" });
  });
});

describe("useAuth session ending", () => {
  const account = { user: { id: "adv1", is_anonymous: false } };

  beforeEach(() => {
    listener = null;
    currentSession = account;
    authApi.signOut.mockClear();
  });

  it("has no ended session while signed in or before anyone has signed in", async () => {
    const { result } = await mountAuth();
    expect(result.current.sessionEnded).toBeNull();

    currentSession = null;
    const fresh = await mountAuth();
    act(() => listener?.("SIGNED_OUT", null));
    expect(fresh.result.current.sessionEnded).toBeNull();
  });

  it("removes unsaved answers kept in this browser on a deliberate sign-out, but not when a session lapses", async () => {
    localStorage.setItem("eaa.intake-backup.v1:adv1:s1", "{}");
    localStorage.setItem("other", "keep");
    const { result } = await mountAuth();
    await act(async () => { await result.current.signOut("expired"); });
    expect(localStorage.getItem("eaa.intake-backup.v1:adv1:s1")).not.toBeNull();
    await act(async () => { await result.current.signOut(); });
    expect(localStorage.getItem("eaa.intake-backup.v1:adv1:s1")).toBeNull();
    expect(localStorage.getItem("other")).toBe("keep");
    localStorage.clear();
  });

  it("calls a deliberate sign-out a sign-out", async () => {
    const { result } = await mountAuth();
    await act(async () => { await result.current.signOut(); });
    act(() => listener?.("SIGNED_OUT", null));
    expect(authApi.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.sessionEnded).toBe("signed_out");
  });

  it("calls a session that ended without a sign-out an expired one", async () => {
    const { result } = await mountAuth();
    act(() => listener?.("SIGNED_OUT", null));
    expect(result.current.sessionEnded).toBe("expired");
    expect(result.current.user).toBeNull();
  });

  it("lets the app end a session it found to be expired and say why", async () => {
    const { result } = await mountAuth();
    await act(async () => { await result.current.signOut("expired"); });
    act(() => listener?.("SIGNED_OUT", null));
    expect(result.current.sessionEnded).toBe("expired");
  });

  it("forgets the reason once someone signs in again", async () => {
    const { result } = await mountAuth();
    act(() => listener?.("SIGNED_OUT", null));
    expect(result.current.sessionEnded).toBe("expired");
    act(() => listener?.("SIGNED_IN", account));
    expect(result.current.sessionEnded).toBeNull();
    expect(result.current.user?.id).toBe("adv1");
  });

  it("doesn't let one sign-out's reason colour the next ended session", async () => {
    const { result } = await mountAuth();
    await act(async () => { await result.current.signOut(); });
    act(() => listener?.("SIGNED_OUT", null));
    act(() => listener?.("SIGNED_IN", account));
    act(() => listener?.("SIGNED_OUT", null));
    expect(result.current.sessionEnded).toBe("expired");
  });
});

describe("useAuth email sign-up", () => {
  const callback = () => `${window.location.origin}/auth/callback`;

  beforeEach(() => {
    currentSession = null;
    authApi.signUp.mockReset().mockResolvedValue({ data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null }, error: null });
    authApi.resend.mockReset().mockResolvedValue({ data: { user: null, session: null }, error: null });
    authApi.verifyOtp.mockReset().mockResolvedValue({ data: { user: null, session: null }, error: null });
  });

  it("sends the confirmation link to the callback page, which then goes on to the Chamber", async () => {
    const { result } = await mountAuth();
    let outcome: Awaited<ReturnType<typeof result.current.signUp>> | undefined;
    await act(async () => {
      outcome = await result.current.signUp("jo@acme.com", "secret12", "Acme");
    });
    expect(outcome).toEqual({ error: null, alreadyRegistered: false });
    expect(authApi.signUp).toHaveBeenCalledWith({
      email: "jo@acme.com",
      password: "secret12",
      options: { emailRedirectTo: callback(), data: { company_name: "Acme" } },
    });
  });

  it("carries where the person was headed through the link", async () => {
    const { result } = await mountAuth();
    await act(async () => {
      await result.current.signUp("jo@acme.com", "secret12", undefined, "/advisor");
    });
    expect(authApi.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`${callback()}?next=%2Fadvisor`);
  });

  it("recognises Supabase's answer for an address that already has an account", async () => {
    // With confirmation on, Supabase hides that the address exists: a user with no identities, no email sent.
    authApi.signUp.mockResolvedValue({ data: { user: { id: "obfuscated", identities: [] }, session: null }, error: null });
    const { result } = await mountAuth();
    let outcome: Awaited<ReturnType<typeof result.current.signUp>> | undefined;
    await act(async () => {
      outcome = await result.current.signUp("jo@acme.com", "secret12");
    });
    expect(outcome).toEqual({ error: null, alreadyRegistered: true });
  });

  it("resends the confirmation link to the callback page", async () => {
    const { result } = await mountAuth();
    await act(async () => {
      await result.current.resendConfirmation("jo@acme.com");
    });
    expect(authApi.resend).toHaveBeenCalledWith({ type: "signup", email: "jo@acme.com", options: { emailRedirectTo: callback() } });
  });

  it("confirms a sign-up with the emailed code", async () => {
    const { result } = await mountAuth();
    await act(async () => {
      await result.current.verifySignupCode("jo@acme.com", "123456");
    });
    expect(authApi.verifyOtp).toHaveBeenCalledWith({ email: "jo@acme.com", token: "123456", type: "email" });
  });

  it("verifies a token from a link that points at the app", async () => {
    const { result } = await mountAuth();
    let outcome: { error: Error | null } | undefined;
    await act(async () => {
      outcome = await result.current.confirmEmailToken("hash123", "email");
    });
    expect(authApi.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash123", type: "email" });
    expect(outcome?.error).toBeNull();
  });
});
