import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DEMO_CHAMBER_DATA } from "@/data/chamberTypes";

const auth = {
  isAnonymous: true,
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const { default: ReckoningTab } = await import("./ReckoningTab");

const renderReckoning = () =>
  render(
    <MemoryRouter>
      <ReckoningTab data={DEMO_CHAMBER_DATA} peoName={null} sessionId="s1" onSubmit={async () => true} />
    </MemoryRouter>,
  );

describe("ReckoningTab account gate", () => {
  beforeEach(() => {
    auth.isAnonymous = true;
    auth.requestEmailCode = vi.fn().mockResolvedValue({ error: null, emailInUse: false });
    auth.verifyEmailCode = vi.fn().mockResolvedValue({ error: null });
  });

  it("asks a guest to verify an email before they can sign or submit", () => {
    renderReckoning();
    expect(screen.getByRole("heading", { name: "Verify your email to certify" })).toBeInTheDocument();
    expect(screen.queryByText("Click to sign digitally")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate The Manuscript/ })).not.toBeInTheDocument();
  });

  it("emails a code, then asks for it", async () => {
    renderReckoning();
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: " jo@acme.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByLabelText("6-digit code")).toBeInTheDocument();
    expect(auth.requestEmailCode).toHaveBeenCalledWith("jo@acme.com");
  });

  it("tells a guest whose email already has an account what to do, without losing their place", async () => {
    auth.requestEmailCode = vi.fn().mockResolvedValue({ error: new Error("exists"), emailInUse: true });
    renderReckoning();
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "jo@acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText(/already has an account/)).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });

  it("checks the code the guest enters and explains a wrong one", async () => {
    auth.verifyEmailCode = vi.fn().mockResolvedValue({ error: new Error("Token has expired or is invalid") });
    renderReckoning();
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "jo@acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(auth.verifyEmailCode).toHaveBeenCalledWith("jo@acme.com", "123456"));
    expect(await screen.findByText(/That code didn't work/)).toBeInTheDocument();
  });

  it("shows the signature step once the email is verified", () => {
    auth.isAnonymous = false;
    renderReckoning();
    expect(screen.queryByRole("heading", { name: "Verify your email to certify" })).not.toBeInTheDocument();
    expect(screen.getByText("Click to sign digitally")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate The Manuscript/ })).toBeInTheDocument();
  });
});
