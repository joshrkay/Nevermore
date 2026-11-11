import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = {
  user: null as { id: string } | null,
  loading: false,
  isAnonymous: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmation: vi.fn(),
  verifySignupCode: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const toast = { error: vi.fn(), success: vi.fn() };
vi.mock("sonner", () => ({ toast }));

const { default: AuthPage } = await import("./AuthPage");

const renderLogin = (state?: Record<string, unknown>) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/advisor" element={<p>Advisor queue</p>} />
        <Route path="/advisor/submissions/:id" element={<p>One submission</p>} />
        <Route path="/start" element={<p>The Chamber</p>} />
      </Routes>
    </MemoryRouter>,
  );

const signInAs = (email: string) => {
  fireEvent.change(screen.getByPlaceholderText("you@company.com"), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "hunter22" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
};

describe("AuthPage", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.isAnonymous = false;
    auth.signIn.mockReset().mockResolvedValue({ error: null });
    auth.signUp.mockReset().mockResolvedValue({ error: null, alreadyRegistered: false });
    auth.resendConfirmation.mockReset().mockResolvedValue({ error: null });
    auth.verifySignupCode.mockReset().mockResolvedValue({ error: null });
    toast.error.mockReset();
    toast.success.mockReset();
  });

  it("labels every field, so a screen reader names it and a password manager knows which password it is", () => {
    renderLogin();
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");

    fireEvent.click(screen.getByRole("button", { name: "Create one" }));
    expect(screen.getByLabelText("Company Name")).toHaveAttribute("autocomplete", "organization");
    expect(screen.getByLabelText("Company Name")).toHaveAttribute("maxlength", "200");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
  });

  it("offers an advisor the broker sign-in with Google or Microsoft, and never offers it to a prospect", () => {
    renderLogin({ audience: "advisor", from: { pathname: "/advisor" } });
    expect(screen.getByRole("link", { name: "Sign in with Google or Microsoft" })).toHaveAttribute("href", "/broker/sign-in");
    cleanup();
    renderLogin();
    expect(screen.queryByText(/Google|Microsoft/)).not.toBeInTheDocument();
  });

  it("says so when an advisor's session expired", () => {
    renderLogin({ audience: "advisor", reason: "expired", from: { pathname: "/advisor" } });
    expect(screen.getByRole("status")).toHaveTextContent("Your session expired. Sign in again to continue.");
    expect(screen.getByRole("heading", { name: "Advisor Sign In" })).toBeInTheDocument();
  });

  it("confirms a deliberate sign-out", () => {
    renderLogin({ audience: "advisor", reason: "signed_out" });
    expect(screen.getByRole("status")).toHaveTextContent("You've been signed out.");
  });

  it("shows no notice for an ordinary visit", () => {
    renderLogin({ audience: "advisor", from: { pathname: "/advisor" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    renderLogin();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("returns an advisor to the page they were on", async () => {
    renderLogin({ audience: "advisor", reason: "expired", from: { pathname: "/advisor/submissions/s1", search: "" } });
    signInAs("adv@example.com");
    expect(await screen.findByText("One submission")).toBeInTheDocument();
  });

  it("takes an advisor with no remembered page to the queue, not the prospect intake", async () => {
    renderLogin({ audience: "advisor", reason: "signed_out" });
    signInAs("adv@example.com");
    await waitFor(() => expect(screen.getByText("Advisor queue")).toBeInTheDocument());
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
  });

  it("still takes a prospect to the Chamber", async () => {
    renderLogin();
    signInAs("pat@example.com");
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
  });

  it("opens on creating an account for a visitor sent here because guest sessions aren't available", () => {
    renderLogin({ reason: "account_needed", from: { pathname: "/start" } });
    expect(screen.getByRole("heading", { name: "Start your intake" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  describe("creating an account", () => {
    const signUpAs = (email: string) => {
      fireEvent.click(screen.getByRole("button", { name: "Create one" }));
      fireEvent.change(screen.getByPlaceholderText("you@company.com"), { target: { value: email } });
      fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "hunter22" } });
      fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    };

    it("says where the link went and lets the person send another, instead of a toast that vanishes", async () => {
      renderLogin();
      signUpAs("pat@example.com");
      expect(await screen.findByRole("status")).toHaveTextContent("We sent a confirmation email to pat@example.com");
      expect(auth.signUp).toHaveBeenCalledWith("pat@example.com", "hunter22", undefined, "/start");
      expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Create Account" })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Send a new email" }));
      await waitFor(() => expect(auth.resendConfirmation).toHaveBeenCalledWith("pat@example.com", "/start"));
      expect(toast.success).toHaveBeenCalledWith("We sent a new email to pat@example.com.");

      fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
      expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    });

    it("confirms the account with the emailed code and goes on to the Chamber", async () => {
      renderLogin();
      signUpAs("pat@example.com");
      const input = await screen.findByLabelText("6-digit code");
      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => expect(auth.verifySignupCode).toHaveBeenCalledWith("pat@example.com", "123456"));
      expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    });

    it("says so when the code is wrong, and stays on the page", async () => {
      auth.verifySignupCode.mockResolvedValue({ error: Object.assign(new Error("Token has expired or is invalid"), { code: "otp_expired" }) });
      renderLogin();
      signUpAs("pat@example.com");
      fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work.");
      expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
    });

    it("sends a person who already has an account to sign in, since no link is coming", async () => {
      auth.signUp.mockResolvedValue({ error: null, alreadyRegistered: true });
      renderLogin();
      signUpAs("pat@example.com");
      expect(await screen.findByRole("status")).toHaveTextContent("That email already has an account. Sign in with it below.");
      expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    });

    it("says when the project's hourly email quota is used up, not just Supabase's terse reason", async () => {
      auth.signUp.mockResolvedValue({
        error: Object.assign(new Error("email rate limit exceeded"), { code: "over_email_send_rate_limit", status: 429 }),
        alreadyRegistered: false,
      });
      renderLogin();
      signUpAs("pat@example.com");
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("lot of emails")));
      expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    });

    it("says when too many sign-ups come from one network", async () => {
      auth.signUp.mockResolvedValue({
        error: Object.assign(new Error("Request rate limit reached"), { code: "over_request_rate_limit", status: 429 }),
        alreadyRegistered: false,
      });
      renderLogin();
      signUpAs("pat@example.com");
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Too many attempts")));
    });

    it("tells the person to wait a minute when a new email is asked for too soon", async () => {
      auth.resendConfirmation.mockResolvedValue({
        error: Object.assign(new Error("For security purposes, you can only request this after 60 seconds"), { code: "over_email_send_rate_limit", status: 429 }),
      });
      renderLogin();
      signUpAs("pat@example.com");
      fireEvent.click(await screen.findByRole("button", { name: "Send a new email" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("wait a minute")));
    });

    it("shows Supabase's reason when sign-up fails", async () => {
      auth.signUp.mockResolvedValue({ error: new Error("Password should be at least 6 characters."), alreadyRegistered: false });
      renderLogin();
      signUpAs("pat@example.com");
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Password should be at least 6 characters."));
      expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    });
  });

  it("takes a sign-in refused until the email is confirmed to the code entry, with a new email on offer", async () => {
    auth.signIn.mockResolvedValue({ error: Object.assign(new Error("Email not confirmed"), { code: "email_not_confirmed" }) });
    renderLogin();
    signInAs("pat@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Confirm your email first. We sent a confirmation email to pat@example.com when you signed up. Open the link in it, or enter its 6-digit code here",
    );
    expect(toast.error).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send a new email" }));
    await waitFor(() => expect(auth.resendConfirmation).toHaveBeenCalledWith("pat@example.com", "/start"));
    // The new email's code goes in right here.
    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(auth.verifySignupCode).toHaveBeenCalledWith("pat@example.com", "654321"));
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
  });
});
