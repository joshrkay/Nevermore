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

/** Opens the callback page as if the browser had loaded `address`. */
const open = (address: string) => {
  window.history.replaceState(null, "", address);
  const url = new URL(address, window.location.origin);
  return render(
    <MemoryRouter initialEntries={[url.pathname + url.search]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/start" element={<p>The Chamber</p>} />
        <Route path="/advisor" element={<p>Advisor queue</p>} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

const confirmedUser = { id: "u1", email: "pat@example.com", email_confirmed_at: "2026-11-03T12:00:00Z" };

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.isAnonymous = false;
    auth.confirmEmailToken.mockReset().mockResolvedValue({ error: null });
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

    it("tells a person already confirmed in this browser that they're fine (a link opened twice)", () => {
      auth.user = confirmedUser;
      open(expired);
      expect(screen.getByRole("heading", { name: "Your email is confirmed" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(screen.getByText("The Chamber")).toBeInTheDocument();
    });

    it("does not treat a guest session as a confirmed account", () => {
      auth.user = { id: "guest" };
      auth.isAnonymous = true;
      open(expired);
      expect(screen.getByRole("heading", { name: "This link didn't work" })).toBeInTheDocument();
    });
  });

  describe("when Supabase verified the link and sent a session", () => {
    const granted = "/auth/callback#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=signup";

    it("waits while supabase-js signs the person in", () => {
      auth.loading = true;
      open(granted);
      expect(screen.getByRole("heading", { name: "Confirming your email" })).toBeInTheDocument();
    });

    it("goes on to the Chamber and says the email is confirmed", async () => {
      auth.user = confirmedUser;
      open(granted);
      expect(await screen.findByText("The Chamber")).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith("Email confirmed. You're signed in.");
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
      open(token);
      expect(auth.confirmEmailToken).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Confirm my email" }));
      await waitFor(() => expect(auth.confirmEmailToken).toHaveBeenCalledWith("hash123", "email"));
      expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    });

    it("takes the token from the fragment and keeps where the person was headed", async () => {
      open("/auth/callback?next=%2Fadvisor#token_hash=hash456&type=email");
      fireEvent.click(screen.getByRole("button", { name: "Confirm my email" }));
      await waitFor(() => expect(auth.confirmEmailToken).toHaveBeenCalledWith("hash456", "email"));
      expect(await screen.findByText("Advisor queue")).toBeInTheDocument();
    });

    it("explains a token that no longer works", async () => {
      auth.confirmEmailToken.mockResolvedValue({ error: Object.assign(new Error("Token has expired or is invalid"), { code: "otp_expired" }) });
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
