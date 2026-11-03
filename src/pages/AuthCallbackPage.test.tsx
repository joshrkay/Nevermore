import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

type TestUser = { id: string; email?: string; email_confirmed_at?: string | null };
const auth = {
  user: null as TestUser | null,
  loading: false,
  isAnonymous: false,
  confirmEmailToken: vi.fn(),
  resendConfirmation: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const toast = { error: vi.fn(), success: vi.fn() };
vi.mock("sonner", () => ({ toast }));

const { default: AuthCallbackPage } = await import("./AuthCallbackPage");

const tree = (entry: string) => (
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/start" element={<p>The Chamber</p>} />
      <Route path="/advisor" element={<p>Advisor queue</p>} />
      <Route path="/login" element={<p>Login page</p>} />
    </Routes>
  </MemoryRouter>
);

/** Opens the callback page as if the browser had loaded `address`. */
const open = (address: string) => {
  window.history.replaceState(null, "", address);
  const url = new URL(address, window.location.origin);
  return render(tree(url.pathname + url.search));
};

const confirmedUser = { id: "u1", email: "pat@example.com", email_confirmed_at: "2026-11-03T12:00:00Z" };

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.isAnonymous = false;
    auth.confirmEmailToken.mockReset().mockResolvedValue({ error: null, email: null });
    auth.resendConfirmation.mockReset().mockResolvedValue({ error: null });
    toast.success.mockReset();
  });
  afterEach(() => window.history.replaceState(null, "", "/"));

  describe("when Supabase refused the link", () => {
    const expired = "/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

    it("says the link expired or was used, instead of dropping the person into a guest session", () => {
      open(expired);
      expect(screen.getByRole("heading", { name: "This link didn't work" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("This link has expired or was already used");
      expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    });

    it("sends a new link to the address the person types", async () => {
      open(expired);
      fireEvent.change(screen.getByLabelText("Email you signed up with"), { target: { value: " pat@example.com " } });
      fireEvent.click(screen.getByRole("button", { name: "Send a new link" }));
      await waitFor(() => expect(auth.resendConfirmation).toHaveBeenCalledWith("pat@example.com", "/start"));
      expect(await screen.findByRole("status")).toHaveTextContent("If pat@example.com has an account waiting to be confirmed");
    });

    it("words any other failure itself, never echoing text from the link", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      open("/auth/callback?error=server_error&error_description=Your+account+is+locked.+Call+555-0100");
      expect(screen.getByRole("alert")).toHaveTextContent("We couldn't confirm your email with this link.");
      expect(screen.queryByText(/555-0100/)).not.toBeInTheDocument();
      warn.mockRestore();
    });

    it("still says the link failed when this browser is signed in, since it may be someone else's link", () => {
      auth.user = { ...confirmedUser, email: "advisor@example.com" };
      open(expired);
      expect(screen.getByRole("heading", { name: "This link didn't work" })).toBeInTheDocument();
      expect(screen.getByText("This browser is signed in as advisor@example.com.")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(screen.getByText("The Chamber")).toBeInTheDocument();
    });

    it("tells a signed-in person who opens the page with no link that they're confirmed", () => {
      auth.user = confirmedUser;
      open("/auth/callback");
      expect(screen.getByRole("heading", { name: "Your email is confirmed" })).toBeInTheDocument();
    });

    it("sends a guest back to their intake, since a guest's link is an email change with no password or sign-up", () => {
      auth.user = { id: "guest" };
      auth.isAnonymous = true;
      open(expired);
      expect(screen.getByRole("heading", { name: "This link didn't work" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Back to your intake" })).toHaveAttribute("href", "/start");
      expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Email you signed up with")).not.toBeInTheDocument();
    });
  });

  describe("when Supabase verified the link and sent a session", () => {
    const granted = "/auth/callback#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=signup";

    it("waits while supabase-js signs the person in, then goes on once the session arrives", async () => {
      auth.loading = true;
      const view = open(granted);
      expect(screen.getByRole("heading", { name: "Confirming your email" })).toBeInTheDocument();
      auth.loading = false;
      auth.user = confirmedUser;
      view.rerender(tree("/auth/callback"));
      expect(await screen.findByText("The Chamber")).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith("Email confirmed. You're signed in as pat@example.com.");
    });

    it("goes on to the Chamber and says the email is confirmed", async () => {
      auth.user = confirmedUser;
      open(granted);
      expect(await screen.findByText("The Chamber")).toBeInTheDocument();
      // Names the account, since a link someone else sent would sign this browser in as them.
      expect(toast.success).toHaveBeenCalledWith("Email confirmed. You're signed in as pat@example.com.");
    });

    it("goes where the person was headed, but only on this site", async () => {
      auth.user = confirmedUser;
      open(`/auth/callback?next=%2Fadvisor${granted.slice(granted.indexOf("#"))}`);
      expect(await screen.findByText("Advisor queue")).toBeInTheDocument();
    });

    it("refuses a destination off the site", async () => {
      auth.user = confirmedUser;
      open(`/auth/callback?next=https%3A%2F%2Fevil.example${granted.slice(granted.indexOf("#"))}`);
      expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    });

    it("says so when no session came of it", () => {
      open(granted);
      expect(screen.getByRole("heading", { name: "This link didn't work" })).toBeInTheDocument();
    });
  });

  describe("when the link carries a token for the app to verify", () => {
    const token = "/auth/callback?token_hash=hash123&type=email";

    it("verifies only when the person clicks, so a mail scanner opening the link can't use it up", async () => {
      auth.confirmEmailToken.mockResolvedValue({ error: null, email: "pat@example.com" });
      open(token);
      expect(auth.confirmEmailToken).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Confirm my email" }));
      await waitFor(() => expect(auth.confirmEmailToken).toHaveBeenCalledWith("hash123", "email"));
      expect(await screen.findByText("The Chamber")).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith("Email confirmed. You're signed in as pat@example.com.");
    });

    it("keeps the button after a request that never got an answer, since the token wasn't spent", async () => {
      const offline = Object.assign(new Error("Failed to fetch"), { status: 0, name: "AuthRetryableFetchError" });
      auth.confirmEmailToken.mockResolvedValueOnce({ error: offline, email: null }).mockResolvedValueOnce({ error: null, email: "pat@example.com" });
      open(token);
      fireEvent.click(screen.getByRole("button", { name: "Confirm my email" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server.");
      expect(screen.queryByRole("heading", { name: "This link didn't work" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Confirm my email" }));
      expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    });

    it("takes the token from the fragment and keeps where the person was headed", async () => {
      open("/auth/callback?next=%2Fadvisor#token_hash=hash456&type=email");
      fireEvent.click(screen.getByRole("button", { name: "Confirm my email" }));
      await waitFor(() => expect(auth.confirmEmailToken).toHaveBeenCalledWith("hash456", "email"));
      expect(await screen.findByText("Advisor queue")).toBeInTheDocument();
    });

    it.each([
      ["rate-limited", { status: 429 }],
      ["a server error", { status: 500 }],
      ["a gateway error", { status: 502 }],
    ])("keeps the button after %s, since the token was never looked at", async (_, fields) => {
      auth.confirmEmailToken.mockResolvedValue({ error: Object.assign(new Error("try later"), fields), email: null });
      open(token);
      fireEvent.click(screen.getByRole("button", { name: "Confirm my email" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the server.");
      expect(screen.getByRole("button", { name: "Confirm my email" })).toBeInTheDocument();
    });

    it.each([
      ["a 403 with no code", { status: 403 }],
      ["otp_expired with no status", { code: "otp_expired" }],
    ])("treats %s as a refused token", async (_, fields) => {
      auth.confirmEmailToken.mockResolvedValue({ error: Object.assign(new Error("refused"), fields), email: null });
      open(token);
      fireEvent.click(screen.getByRole("button", { name: "Confirm my email" }));
      expect(await screen.findByRole("heading", { name: "This link didn't work" })).toBeInTheDocument();
    });

    it("moves focus to the failure's heading, since the button that had it is gone", async () => {
      auth.confirmEmailToken.mockResolvedValue({ error: Object.assign(new Error("refused"), { code: "otp_expired", status: 403 }), email: null });
      open(token);
      const button = screen.getByRole("button", { name: "Confirm my email" });
      button.focus();
      fireEvent.click(button);
      const heading = await screen.findByRole("heading", { name: "This link didn't work" });
      expect(document.activeElement).toBe(heading);
    });

    it("explains a token that no longer works", async () => {
      auth.confirmEmailToken.mockResolvedValue({ error: Object.assign(new Error("Token has expired or is invalid"), { code: "otp_expired", status: 403 }), email: null });
      open(token);
      fireEvent.click(screen.getByRole("button", { name: "Confirm my email" }));
      expect(await screen.findByRole("heading", { name: "This link didn't work" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("This link has expired or was already used");
    });
  });

  it("has nothing to do for a visit with no link", () => {
    open("/auth/callback");
    expect(screen.getByRole("heading", { name: "Nothing to confirm here" })).toBeInTheDocument();
  });
});
