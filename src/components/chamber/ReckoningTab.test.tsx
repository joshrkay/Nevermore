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

describe("ReckoningTab certification", () => {
  beforeEach(() => {
    auth.isAnonymous = false;
  });

  const renderWith = (props: Partial<React.ComponentProps<typeof ReckoningTab>> = {}) =>
    render(
      <MemoryRouter>
        <ReckoningTab data={DEMO_CHAMBER_DATA} peoName={null} sessionId="s1" onSubmit={async () => true} {...props} />
      </MemoryRouter>,
    );

  const tickAll = () => screen.getAllByRole("checkbox").forEach((box) => fireEvent.click(box));
  const submitButton = () => screen.getByRole("button", { name: /Generate The Manuscript/ });
  const fill = (name: string, role: string) => {
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: name } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: role } });
  };

  it("blocks submission until every part of the certification is complete, and says what's missing", () => {
    renderWith();
    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(/Still needed: tick each statement above, your full name, your role/)).toBeInTheDocument();

    tickAll();
    expect(submitButton()).toBeDisabled();

    fill("Jo Doe", "");
    fireEvent.click(screen.getByText("Click to sign digitally"));
    expect(submitButton()).toBeDisabled(); // a role is required to sign
    expect(screen.queryByText(/Jo Doe,/)).not.toBeInTheDocument();

    fill("Jo Doe", "CEO");
    expect(screen.getByText(/Still needed: sign/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Click to sign digitally"));
    expect(submitButton()).toBeEnabled();
  });

  it("won't submit when a consent statement is unticked", () => {
    renderWith();
    tickAll();
    fill("Jo Doe", "CEO");
    fireEvent.click(screen.getByText("Click to sign digitally"));
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(submitButton()).toBeDisabled();
  });

  it("submits the signer, role, signing time and the exact consent wording, then confirms", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderWith({ onSubmit, peoName: "Some PEO" });
    tickAll();
    fill("  Jo Doe ", " CEO ");
    fireEvent.click(screen.getByText("Click to sign digitally"));
    fireEvent.click(submitButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const sent = onSubmit.mock.calls[0][0];
    expect(sent).toMatchObject({
      signer_name: "Jo Doe",
      signer_title: "CEO",
      consent_text_version: CONSENT_TEXT_VERSION,
      consent_version: CONSENT_TEXT_VERSION,
    });
    expect(Number.isNaN(Date.parse(sent.signed_at))).toBe(false);
    expect(sent.consent_text).toHaveLength(4);
    expect(sent.consent_text[0]).toMatch(/accurate and complete/);
  });

  it("keeps the form and explains when the certification couldn't be saved", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    renderWith({ onSubmit });
    tickAll();
    fill("Jo Doe", "CEO");
    fireEvent.click(screen.getByText("Click to sign digitally"));
    fireEvent.click(submitButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it("shows an already-certified intake as certified instead of asking again", () => {
    renderWith({
      certification: {
        status: "certified",
        submission: { signer_name: "Jo Doe", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-1" },
      },
    });
    expect(screen.getByText("Certified and submitted")).toBeInTheDocument();
    expect(screen.getByText(/Signed by Jo Doe, CEO/)).toBeInTheDocument();
    expect(screen.getByText(/you'll be asked to certify again/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate The Manuscript/ })).not.toBeInTheDocument();
  });

  it("asks for re-certification when answers changed after certifying, prefilling the signer", () => {
    renderWith({
      certification: {
        status: "stale",
        submission: { signer_name: "Jo Doe", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-1" },
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/changed after you certified/);
    expect(screen.getByLabelText("Full name")).toHaveValue("Jo Doe");
    expect(submitButton()).toBeDisabled(); // a fresh signature and consent are still required
  });

  it("drops a signature when the answers change after signing", () => {
    const { rerender } = renderWith();
    tickAll();
    fill("Jo Doe", "CEO");
    fireEvent.click(screen.getByText("Click to sign digitally"));
    expect(submitButton()).toBeEnabled();
    rerender(
      <MemoryRouter>
        <ReckoningTab data={{ ...DEMO_CHAMBER_DATA, company_name: "Changed Co" }} peoName={null} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    expect(submitButton()).toBeDisabled();
    expect(screen.getByText("Click to sign digitally")).toBeInTheDocument();
  });
});
