import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const auth = {
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const { default: VerifyEmailGate } = await import("./VerifyEmailGate");

const sendCode = (email = "jo@acme.com") => {
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: ` ${email} ` } });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
};

const authError = (message: string, fields: { code?: string; status?: number } = {}) => Object.assign(new Error(message), fields);

describe("VerifyEmailGate", () => {
  beforeEach(() => {
    auth.requestEmailCode.mockReset().mockResolvedValue({ error: null, emailInUse: false });
    auth.verifyEmailCode.mockReset().mockResolvedValue({ error: null });
  });

  it("asks for the code once it is sent", async () => {
    render(<VerifyEmailGate />);
    sendCode();
    await screen.findByText("We sent a code to jo@acme.com.");
    expect(auth.requestEmailCode).toHaveBeenCalledWith("jo@acme.com");
  });

  it("blames the address only when the address is the problem", async () => {
    auth.requestEmailCode.mockResolvedValue({ error: authError("Unable to validate email address: invalid format", { status: 400 }), emailInUse: false });
    render(<VerifyEmailGate />);
    sendCode("jo@acme");
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the address and try again");
  });

  // QA F3: Supabase Auth couldn't send the email (its Resend key was refused), and the gate said to check the address.
  it("says the email couldn't be sent right now, not that the address is wrong, when sending fails on our side", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    auth.requestEmailCode.mockResolvedValue({ error: authError("Error sending email change email", { code: "unexpected_failure", status: 500 }), emailInUse: false });
    render(<VerifyEmailGate />);
    sendCode();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/We couldn't send the email right now\. Try again in a minute\. \(Error code [A-Z]{8}\.\)/);
    expect(alert).not.toHaveTextContent("Check the address");
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("says to wait a minute when this address was just emailed", async () => {
    auth.requestEmailCode.mockResolvedValue({
      error: authError("For security purposes, you can only request this after 60 seconds", { code: "over_email_send_rate_limit", status: 429 }),
      emailInUse: false,
    });
    render(<VerifyEmailGate />);
    sendCode();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("wait a minute");
    expect(alert).not.toHaveTextContent("Check the address");
    // Still on the address step, so they can ask again.
    expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
  });

  it("says it is not their address when the project's hourly email quota is used up, and that a minute won't help", async () => {
    auth.requestEmailCode.mockResolvedValue({
      error: authError("email rate limit exceeded", { code: "over_email_send_rate_limit", status: 429 }),
      emailInUse: false,
    });
    render(<VerifyEmailGate />);
    sendCode();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("lot of emails"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("Check the address");
    expect(screen.getByRole("alert")).not.toHaveTextContent("a minute");
  });

  it("says so when too many attempts come from one network", async () => {
    auth.requestEmailCode.mockResolvedValue({ error: authError("Request rate limit reached", { code: "over_request_rate_limit", status: 429 }), emailInUse: false });
    render(<VerifyEmailGate />);
    sendCode();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
  });
});
