import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { MemoryRouter } from "react-router-dom";
import { DEMO_CHAMBER_DATA } from "@/data/chamberTypes";

const auth = {
  isAnonymous: true,
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { default: ReckoningTab } = await import("./ReckoningTab");
const { CONSENT_TEXT_VERSION } = await import("@/data/certification");

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
  const onSubmit = vi.fn();
  const submitButton = () => screen.getByRole("button", { name: /Generate The Manuscript/ });

  const mount = (data = DEMO_CHAMBER_DATA) => {
    const tree = (d: typeof data) => (
      <MemoryRouter>
        <ReckoningTab data={d} peoName={null} sessionId="s1" onSubmit={onSubmit} />
      </MemoryRouter>
    );
    const view = render(tree(data));
    return { rerenderWith: (d: typeof data) => view.rerender(tree(d)) };
  };
  const checkAll = () => screen.getAllByRole("checkbox").forEach((c) => fireEvent.click(c));
  const fillSigner = (name = " Jo Doe ", title = " CEO ") => {
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: name } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: title } });
  };
  const sign = () => fireEvent.click(screen.getByText("Click to sign digitally"));

  beforeEach(() => {
    auth.isAnonymous = false;
    onSubmit.mockReset().mockResolvedValue(true);
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it("shows the consent wording with its version and draft marker", () => {
    mount();
    expect(screen.getByText(/The information I've provided is accurate and complete/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Consent wording ${CONSENT_TEXT_VERSION}`))).toBeInTheDocument();
    expect(screen.getByText(/DRAFT: NOT LEGALLY REVIEWED/)).toBeInTheDocument();
  });

  it("blocks submission until every part of the certification is complete, and says what is missing", () => {
    mount();
    expect(submitButton()).toBeDisabled();
    expect(screen.getByTestId("certification-blockers")).toHaveTextContent(/Check every statement/);

    checkAll();
    expect(submitButton()).toBeDisabled();
    expect(screen.getByTestId("certification-blockers")).toHaveTextContent(/Enter your full name · Enter your role · Sign/);

    fillSigner("Jo Doe", "");
    expect(screen.getByTestId("certification-blockers")).toHaveTextContent(/Enter your role/);
    sign();
    expect(toast.error).toHaveBeenCalledWith("Enter your role at the company to sign.");
    expect(submitButton()).toBeDisabled();

    fillSigner();
    sign();
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByTestId("certification-blockers")).not.toBeInTheDocument();
  });

  it("won't take a signature before the statements are checked", () => {
    mount();
    fillSigner();
    sign();
    expect(toast.error).toHaveBeenCalledWith("Check every statement before you sign.");
    expect(submitButton()).toBeDisabled();
  });

  it("sends the signer, role, time and consent wording with the submission", async () => {
    mount();
    checkAll();
    fillSigner();
    sign();
    fireEvent.click(submitButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const sent = onSubmit.mock.calls[0][0];
    expect(sent).toMatchObject({
      signer_name: "Jo Doe",
      signer_title: "CEO",
      // One version, under both names: the app's and the one the database's certification check reads.
      consent_text_version: CONSENT_TEXT_VERSION,
      consent_version: CONSENT_TEXT_VERSION,
    });
    expect(Number.isNaN(Date.parse(sent.signed_at))).toBe(false);
    // Each statement as shown, then the signing statement, so the record is exactly what was agreed to.
    expect(sent.consent_text).toHaveLength(4);
    expect(sent.consent_text[0]).toMatch(/accurate and complete/);
    expect(sent.consent_text[3]).toMatch(/By signing, I certify/);
    expect(sent).not.toHaveProperty("peo");
  });

  it("confirms clearly after a successful submission", async () => {
    mount();
    checkAll();
    fillSigner();
    sign();
    fireEvent.click(submitButton());
    expect(await screen.findByText("Certification recorded")).toBeInTheDocument();
    expect(screen.getByText(/Certified by Jo Doe, CEO/)).toBeInTheDocument();
    expect(screen.getByText(/File ID: EAA-/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download The Manuscript/ })).toHaveAttribute("href", "/manuscript?session=s1");
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows an error, not a confirmation, when the submission can't be saved", async () => {
    onSubmit.mockResolvedValue(false);
    mount();
    checkAll();
    fillSigner();
    sign();
    fireEvent.click(submitButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("We couldn't save your submission. Please try again."));
    expect(screen.queryByText("Certification recorded")).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(submitButton()).toBeEnabled(); // can retry
  });

  it("passes the signed answers to the save, and doesn't confirm if they changed while it was pending", async () => {
    let finish!: (ok: boolean) => void;
    onSubmit.mockImplementation(() => new Promise<boolean>((r) => { finish = r; }));
    const { rerenderWith } = mount();
    checkAll();
    fillSigner();
    sign();
    fireEvent.click(submitButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toBe(JSON.stringify(DEMO_CHAMBER_DATA));

    rerenderWith({ ...DEMO_CHAMBER_DATA, employee_count: 99 }); // Lenore's late answer lands mid-save
    await act(async () => { finish(true); });
    expect(screen.queryByText("Certification recorded")).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Your information changed while we were saving. Review it and certify again.");
    expect(screen.getByRole("alert")).toHaveTextContent(/changed after you signed/);
  });

  it("voids the signature when the information changes after signing", () => {
    const { rerenderWith } = mount();
    checkAll();
    fillSigner();
    sign();
    expect(submitButton()).toBeEnabled();

    rerenderWith({ ...DEMO_CHAMBER_DATA, employee_count: 99 });
    expect(screen.getByRole("alert")).toHaveTextContent(/changed after you signed/);
    expect(submitButton()).toBeDisabled();
    expect(screen.getByText("Click to sign digitally")).toBeInTheDocument();
    screen.getAllByRole("checkbox").forEach((c) => expect(c).not.toBeChecked());
    expect(onSubmit).not.toHaveBeenCalled();

    // Certifying again clears the notice and re-enables submission.
    checkAll();
    sign();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it("withdraws the confirmation if the information changes after submitting", async () => {
    const { rerenderWith } = mount();
    checkAll();
    fillSigner();
    sign();
    fireEvent.click(submitButton());
    expect(await screen.findByText("Certification recorded")).toBeInTheDocument();

    rerenderWith({ ...DEMO_CHAMBER_DATA, company_name: "Renamed Inc" });
    await waitFor(() => expect(screen.queryByText("Certification recorded")).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/certify again/);
  });
});

describe("ReckoningTab on an intake that is already certified", () => {
  const onSubmit = vi.fn();
  const submission = {
    signer_name: "Jo Doe",
    signer_title: "CEO",
    signed_at: "2026-10-01T12:00:00Z",
    file_id: "EAA-2026-S1",
    consent_version: CONSENT_TEXT_VERSION,
    consent_text: ["x"],
  };
  const mountWith = (certification: React.ComponentProps<typeof ReckoningTab>["certification"]) =>
    render(
      <MemoryRouter>
        <ReckoningTab data={DEMO_CHAMBER_DATA} peoName={null} sessionId="s1" onSubmit={onSubmit} certification={certification} />
      </MemoryRouter>,
    );

  beforeEach(() => {
    auth.isAnonymous = false;
    onSubmit.mockReset().mockResolvedValue(true);
  });

  it("is read-only while nothing has changed, so it can't be certified again by accident", () => {
    mountWith({ status: "certified", submission });
    expect(screen.getByRole("status")).toHaveTextContent(/Certified by Jo Doe, CEO/);
    expect(screen.getByRole("link", { name: "View The Manuscript" })).toHaveAttribute("href", "/manuscript?session=s1");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText("Click to sign digitally")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate The Manuscript/ })).not.toBeInTheDocument();
  });

  it("offers certification again once the answers have changed", () => {
    mountWith({ status: "stale", submission });
    expect(screen.getByRole("status")).toHaveTextContent(/Your answers changed after you certified/);
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Generate The Manuscript/ })).toBeInTheDocument();
  });

  it("brings the form back if a signature made this visit is voided, even before the saved state catches up", () => {
    const tree = (d: typeof DEMO_CHAMBER_DATA, certification: React.ComponentProps<typeof ReckoningTab>["certification"]) => (
      <MemoryRouter>
        <ReckoningTab data={d} peoName={null} sessionId="s1" onSubmit={onSubmit} certification={certification} />
      </MemoryRouter>
    );
    const view = render(tree(DEMO_CHAMBER_DATA, { status: "none" }));
    screen.getAllByRole("checkbox").forEach((c) => fireEvent.click(c));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jo Doe" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "CEO" } });
    fireEvent.click(screen.getByText("Click to sign digitally"));

    // The answers move on, while the saved certification still reads "certified".
    view.rerender(tree({ ...DEMO_CHAMBER_DATA, employee_count: 99 }, { status: "certified", submission }));
    expect(screen.getByRole("alert")).toHaveTextContent(/changed after you signed/);
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Generate The Manuscript/ })).toBeDisabled();
  });

  it("offers certification to an intake that has never been certified", () => {
    mountWith({ status: "none" });
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Generate The Manuscript/ })).toBeInTheDocument();
  });
});
