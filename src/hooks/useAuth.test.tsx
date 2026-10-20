import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

let currentSession: { user: { id: string; is_anonymous?: boolean } } | null = null;
const authApi = {
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  getSession: vi.fn(async () => ({ data: { session: currentSession } })),
  signInAnonymously: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
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
    expect(authApi.updateUser).toHaveBeenCalledWith({ email: "jo@acme.com" });
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
