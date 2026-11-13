import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const auth = { user: { id: "u1", email: "pat@example.com" } as { id: string; email?: string } | null, loading: false, isAnonymous: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

// Supabase Auth is the boundary: the real wrappers in src/lib run against these stand-ins.
const mfa = { listFactors: vi.fn(), enroll: vi.fn(), unenroll: vi.fn(), challengeAndVerify: vi.fn() };
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { mfa }, rpc: (...a: unknown[]) => rpc(...a) } }));

const { default: SecondFactorPage } = await import("./SecondFactorPage");

const HeldStub = () => <p>Held mail{useLocation().search}</p>;

const LoginStub = () => {
  const state = useLocation().state as { audience?: string; from?: { pathname: string } } | null;
  return <p>Sign in page for {state?.audience} returning to {state?.from?.pathname ?? "nowhere"}</p>;
};

const renderPage = (state?: Record<string, unknown>) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/advisor/second-factor", state }]}>
      <Routes>
        <Route path="/advisor/second-factor" element={<SecondFactorPage />} />
        <Route path="/advisor" element={<p>Advisor queue</p>} />
        <Route path="/advisor/held" element={<HeldStub />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );

const factor = (over: Record<string, unknown> = {}) => ({ id: "f1", factor_type: "totp", status: "verified", friendly_name: "Authenticator app", ...over });
const factors = (...all: ReturnType<typeof factor>[]) => ({
  data: { all, totp: all.filter((f) => f.status === "verified" && f.factor_type === "totp"), phone: [] },
  error: null,
});

describe("SecondFactorPage", () => {
  beforeEach(() => {
    auth.user = { id: "u1", email: "pat@example.com" };
    auth.loading = false;
    auth.isAnonymous = false;
    rpc.mockReset().mockResolvedValue({ data: true, error: null });
    mfa.listFactors.mockReset().mockResolvedValue(factors());
    mfa.enroll.mockReset();
    mfa.unenroll.mockReset().mockResolvedValue({ data: {}, error: null });
    mfa.challengeAndVerify.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  it("shows nothing after a Google or Microsoft sign-in, which relies on that provider: straight on to where they were going", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    renderPage({ from: { pathname: "/advisor/held", search: "" } });
    expect(await screen.findByText("Held mail")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("advisor_needs_second_factor");
    expect(mfa.enroll).not.toHaveBeenCalled();
  });

  it("asks for the code from their authenticator app at a later sign-in, and goes on once it is right", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor()));
    renderPage({ from: { pathname: "/advisor/held", search: "" } });
    expect(await screen.findByRole("heading", { name: "Enter your code" })).toBeInTheDocument();
    expect(mfa.enroll).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/6-digit code/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Held mail")).toBeInTheDocument();
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" });
  });

  it("says under the field that a wrong code didn't work, and stays on the screen", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor()));
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered" } });
    renderPage({ from: { pathname: "/advisor/held", search: "" } });
    const field = await screen.findByLabelText(/6-digit code/);
    fireEvent.change(field, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("That code didn't work. Check it, or wait for the next one, and try again.");
    expect(field).toHaveAccessibleDescription(error.textContent ?? "");
    expect(field).toBeInvalid();
    expect(screen.queryByText("Held mail")).not.toBeInTheDocument();
  });

  it("goes back to exactly the page they asked for, including its query", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor()));
    renderPage({ from: { pathname: "/advisor/held", search: "?page=2" } });
    fireEvent.change(await screen.findByLabelText(/6-digit code/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Held mail?page=2")).toBeInTheDocument();
  });

  it("takes the old error away while the next try is being checked", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor()));
    mfa.challengeAndVerify
      .mockResolvedValueOnce({ data: null, error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered" } })
      .mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    const field = await screen.findByLabelText(/6-digit code/);
    fireEvent.change(field, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("alert");
    fireEvent.change(field, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("says when the code couldn't be checked at all, so a person doesn't think theirs was wrong", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor()));
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { code: "unexpected_failure", message: "offline" } });
    renderPage();
    fireEvent.change(await screen.findByLabelText(/6-digit code/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't check your code just now. Try again in a minute.");
  });

  it("takes a code typed the way an app shows it, with a space in the middle", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor()));
    renderPage();
    fireEvent.change(await screen.findByLabelText(/6-digit code/), { target: { value: " 123 456 " } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" }));
  });

  it("asks for the code before checking anything when the field is empty or short", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor()));
    renderPage();
    fireEvent.change(await screen.findByLabelText(/6-digit code/), { target: { value: "12 34" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the 6 digits from your authenticator app.");
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  const enrolment = { data: { id: "new1", type: "totp", friendly_name: "Authenticator app", totp: { qr_code: "data:image/svg+xml;utf8,<svg/>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/x" } }, error: null };

  it("walks an advisor with no second factor through setting one up with an authenticator app, then goes on", async () => {
    mfa.enroll.mockResolvedValue(enrolment);
    renderPage({ from: { pathname: "/advisor/held", search: "" } });
    expect(await screen.findByRole("heading", { name: "Add a second step to your sign-in" })).toBeInTheDocument();
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Authenticator app" });
    expect(await screen.findByRole("img", { name: /scan this code with your authenticator app/i })).toHaveAttribute("src", "data:image/svg+xml;utf8,<svg/>");
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/6-digit code \(required\)/), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Turn on and continue" }));
    expect(await screen.findByText("Held mail")).toBeInTheDocument();
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "new1", code: "654321" });
  });

  it("clears a setup that was started and never finished, so setting up again isn't refused for its name", async () => {
    mfa.listFactors.mockResolvedValue(factors(factor({ id: "stale", status: "unverified" })));
    mfa.enroll.mockResolvedValue(enrolment);
    renderPage();
    await screen.findByRole("img", { name: /scan this code/i });
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "stale" });
    expect(mfa.unenroll.mock.invocationCallOrder[0]).toBeLessThan(mfa.enroll.mock.invocationCallOrder[0]);
  });

  it("says a wrong code at setup under the field, and keeps the setup on screen", async () => {
    mfa.enroll.mockResolvedValue(enrolment);
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered" } });
    renderPage();
    fireEvent.change(await screen.findByLabelText(/6-digit code/), { target: { value: "111111" } });
    fireEvent.click(screen.getByRole("button", { name: "Turn on and continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work.");
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
  });

  it("says so, and lets them try again, when setup can't start", async () => {
    mfa.enroll.mockResolvedValueOnce({ data: null, error: { code: "unexpected_failure", message: "offline" } }).mockResolvedValueOnce(enrolment);
    renderPage();
    expect(await screen.findByText("We couldn't start setting up your second step.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("img", { name: /scan this code/i })).toBeInTheDocument();
  });

  it("says so, and lets them try again, when the checks on the sign-in can't be made", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } }).mockResolvedValueOnce({ data: false, error: null });
    renderPage();
    expect(await screen.findByText("We couldn't check your sign-in.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Advisor queue")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to the advisor sign-in, returning to where they were going", () => {
    auth.user = null;
    renderPage({ from: { pathname: "/advisor/held", search: "" } });
    expect(screen.getByText("Sign in page for advisor returning to /advisor/held")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not offer setup to a guest session", () => {
    auth.isAnonymous = true;
    renderPage();
    expect(screen.getByText(/Sign in page for advisor/)).toBeInTheDocument();
    expect(mfa.enroll).not.toHaveBeenCalled();
  });
});
