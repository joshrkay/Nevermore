// The gate and the callback page together, under the app's real BrowserRouter: the gate's redirect
// drops the address's hash, so the callback page only knows the outcome from the address the page
// opened with (initialHref). Each case loads the modules afresh, as a page load does.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

type TestUser = { id: string; email?: string; email_confirmed_at?: string | null };
const auth = {
  user: null as TestUser | null,
  loading: false,
  isAnonymous: false,
  confirmEmailToken: vi.fn(),
  resendConfirmation: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

async function loadPage(address: string) {
  window.history.replaceState(null, "", address);
  vi.resetModules();
  const { default: AuthRedirectGate } = await import("./AuthRedirectGate");
  const { default: AuthCallbackPage } = await import("@/pages/AuthCallbackPage");
  return render(
    <BrowserRouter>
      <AuthRedirectGate>
        <Routes>
          <Route path="/" element={<p>Landing page</p>} />
          <Route path="/start" element={<p>The Chamber</p>} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </AuthRedirectGate>
    </BrowserRouter>,
  );
}

describe("a link result that lands outside /auth/callback", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.isAnonymous = false;
    auth.confirmEmailToken.mockReset().mockResolvedValue({ error: null, email: "pat@example.com" });
  });
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("still explains a refused link after the gate has moved to /auth/callback without the hash", async () => {
    await loadPage("/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(await screen.findByRole("heading", { name: "This link didn't work" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth/callback");
    expect(window.location.hash).toBe("");
    expect(screen.queryByText("Landing page")).not.toBeInTheDocument();
  });

  it("keeps a sign-up token that landed on the bare Site URL, for the click", async () => {
    await loadPage("/#token_hash=abc123&type=email");
    const button = await screen.findByRole("button", { name: "Confirm my email" });
    expect(window.location.pathname).toBe("/auth/callback");
    button.click();
    await waitFor(() => expect(auth.confirmEmailToken).toHaveBeenCalledWith("abc123", "email"));
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
  });

  it("takes an older email's session link on /start through the callback page and back, once signed in", async () => {
    auth.loading = true;
    const view = await loadPage("/start#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=signup");
    // supabase-js is still reading the session: nothing under the gate may start a guest session yet.
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
    auth.loading = false;
    auth.user = { id: "u1", email: "pat@example.com", email_confirmed_at: "2026-11-03T12:00:00Z" };
    const { default: AuthRedirectGate } = await import("./AuthRedirectGate");
    const { default: AuthCallbackPage } = await import("@/pages/AuthCallbackPage");
    view.rerender(
      <BrowserRouter>
        <AuthRedirectGate>
          <Routes>
            <Route path="/" element={<p>Landing page</p>} />
            <Route path="/start" element={<p>The Chamber</p>} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
          </Routes>
        </AuthRedirectGate>
      </BrowserRouter>,
    );
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/start");
  });
});
