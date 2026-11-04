import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const auth = {
  requestSignInCode: vi.fn(),
  verifySignInCode: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const { default: RecoverIntake } = await import("./RecoverIntake");

const askForCode = async (email = "jo@acme.com") => {
  fireEvent.change(screen.getByLabelText("The email you verified"), { target: { value: `  ${email} ` } });
  fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
};

describe("RecoverIntake", () => {
  beforeEach(() => {
    auth.requestSignInCode.mockReset().mockResolvedValue({ error: null, noAccount: false });
    auth.verifySignInCode.mockReset().mockResolvedValue({ error: null });
  });

  it("emails a code to the address, then signs in with it", async () => {
    render(<RecoverIntake />);
    await askForCode();
    expect(auth.requestSignInCode).toHaveBeenCalledWith("jo@acme.com");
    await screen.findByText(/If jo@acme.com has an account with us, a 6-digit sign-in code is on its way/);

    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(auth.verifySignInCode).toHaveBeenCalledWith("jo@acme.com", "123456"));
  });

  it("says the same thing when there's no account for the address, so it reveals nothing", async () => {
    auth.requestSignInCode.mockResolvedValue({ error: null, noAccount: true });
    render(<RecoverIntake />);
    await askForCode("nobody@acme.com");
    await screen.findByText(/If nobody@acme.com has an account with us/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("asks them to wait when codes are being sent too often", async () => {
    auth.requestSignInCode.mockResolvedValue({ error: new Error("For security purposes, you can only request this after 60 seconds"), noAccount: false });
    render(<RecoverIntake />);
    await askForCode();
    expect(await screen.findByRole("alert")).toHaveTextContent("wait a minute");
  });

  it("says it is not their address when the project's hourly email quota is used up", async () => {
    auth.requestSignInCode.mockResolvedValue({
      error: Object.assign(new Error("email rate limit exceeded"), { code: "over_email_send_rate_limit", status: 429 }),
      noAccount: false,
    });
    render(<RecoverIntake />);
    await askForCode();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("lot of emails");
    expect(alert).not.toHaveTextContent("Check the address");
    expect(alert).not.toHaveTextContent("a minute");
  });

  it("says when a code didn't work, and lets them start again with another address", async () => {
    auth.verifySignInCode.mockResolvedValue({ error: new Error("Token has expired or is invalid") });
    render(<RecoverIntake />);
    await askForCode();
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work");

    fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.getByLabelText("The email you verified")).toBeInTheDocument();
  });

  it("won't sign in until the whole code is typed", async () => {
    render(<RecoverIntake />);
    await askForCode();
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "123" } });
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });
});
