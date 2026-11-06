import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { MemoryRouter } from "react-router-dom";
import { DEMO_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ProvenanceMap } from "@/data/provenance";

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
      <ReckoningTab data={DEMO_CHAMBER_DATA} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={async () => true} />
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
    expect(screen.queryByRole("button", { name: /Generate your packet/ })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /Generate your packet/ })).toBeInTheDocument();
  });
});

describe("ReckoningTab certification", () => {
  const onSubmit = vi.fn();
  const submitButton = () => screen.getByRole("button", { name: /Generate your packet/ });

  const mount = (data = DEMO_CHAMBER_DATA) => {
    const tree = (d: typeof data) => (
      <MemoryRouter>
        <ReckoningTab data={d} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} />
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
    // The database assigns the File ID (C-3.1): even an intake that already has one doesn't send it.
    expect(sent).not.toHaveProperty("file_id");
  });

  it("confirms clearly after a successful submission", async () => {
    mount();
    checkAll();
    fillSigner();
    sign();
    fireEvent.click(submitButton());
    expect(await screen.findByText("Certification recorded")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "You're all set." })).toBeInTheDocument();
    expect(screen.getByText(/Certified by Jo Doe, CEO/)).toBeInTheDocument();
    expect(screen.getByText("File ID: EAA-2026-S1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download your packet/ })).toHaveAttribute("href", "/manuscript/EAA-2026-S1");
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
    // The failure stays on screen, the signature is kept, and the same button tries again.
    expect(screen.getByRole("alert", { name: "Submission not saved" })).toHaveTextContent(/Nothing has been recorded; your signature is still here/);
    expect(screen.getByText("Jo Doe, CEO")).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
    expect(submitButton()).toHaveTextContent("Try again");
  });

  it("sends one certification for a double click", async () => {
    let finish!: (ok: boolean) => void;
    onSubmit.mockImplementation(() => new Promise<boolean>((r) => { finish = r; }));
    mount();
    checkAll();
    fillSigner();
    sign();
    const button = submitButton();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await act(async () => { finish(true); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Certification recorded")).toBeInTheDocument();
  });

  it("shows the company and the File ID the database assigned on the confirmation", async () => {
    const tree = (fileId: string | null) => (
      <MemoryRouter>
        <ReckoningTab data={DEMO_CHAMBER_DATA} peoName={null} sessionId="s1" fileId={fileId} onSubmit={onSubmit} />
      </MemoryRouter>
    );
    const view = render(tree(null));
    // Before the first certification there is no File ID: that is not a blocker.
    expect(screen.queryByTestId("certification-blockers")).toHaveTextContent(/Check every statement/);
    expect(screen.getByTestId("certification-blockers")).not.toHaveTextContent(/finish saving/);
    checkAll();
    fillSigner();
    sign();
    const sent = onSubmit.mock.calls.length;
    onSubmit.mockImplementation(async () => {
      view.rerender(tree("EAA-2026-0042")); // the session hook learns the File ID from the save
      return true;
    });
    fireEvent.click(submitButton());
    expect(await screen.findByText("Certification recorded")).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(sent + 1);
    expect(screen.getByText("File ID: EAA-2026-0042")).toBeInTheDocument();
    expect(screen.getByText("Meridian Creative Group")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download your packet/ })).toHaveAttribute("href", "/manuscript/EAA-2026-0042");
  });

  it("blocks on a required answer that is conflicting, and says what to do", () => {
    render(
      <MemoryRouter>
        <ReckoningTab
          data={DEMO_CHAMBER_DATA}
          provenance={{ company_name: { status: "conflicting", source: { kind: "transcript", message_id: "m1" }, updated_at: "2026-11-04T00:00:00Z", candidates: [] } }}
          peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit}
        />
      </MemoryRouter>,
    );
    const callout = screen.getByRole("alert", { name: "Answers still needed" });
    expect(callout).toHaveTextContent("Company legal name");
    expect(callout).toHaveTextContent("You've given two different answers.");
    expect(screen.getByTestId("certification-blockers")).toHaveTextContent("Choose one answer for company legal name");
  });

  it("shows the reason, not the generic message, when the save says why it was refused", async () => {
    onSubmit.mockResolvedValue({ message: "This intake changed elsewhere. Reload the latest and certify again." });
    mount();
    checkAll();
    fillSigner();
    sign();
    fireEvent.click(submitButton());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This intake changed elsewhere. Reload the latest and certify again."),
    );
    expect(screen.queryByText("Certification recorded")).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  // QA F2: the database refused a guest's certification and the page said only "We couldn't save your submission".
  it("says certifying needs a verified email when that is why it was refused, and offers the verification there", async () => {
    auth.requestEmailCode = vi.fn().mockResolvedValue({ error: null, emailInUse: false });
    onSubmit.mockResolvedValue({ message: "Certifying needs a verified email. Verify your email first, then certify again.", verifyEmail: true });
    mount();
    checkAll();
    fillSigner();
    sign();
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert", { name: "Submission not saved" });
    expect(alert).toHaveTextContent("Verify your email first, then certify again.");
    expect(screen.getByRole("heading", { name: "Verify your email to certify" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "jo@acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(auth.requestEmailCode).toHaveBeenCalledWith("jo@acme.com"));
  });

  it("logs a save that threw as one line with an error code, and shows the prospect that code", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    onSubmit.mockRejectedValue({ code: "XX000", message: "internal error" });
    mount();
    checkAll();
    fillSigner();
    sign();
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert", { name: "Submission not saved" });
    const errorCode = /error code ([A-Z]{8})/.exec(alert.textContent ?? "")?.[1];
    expect(errorCode).toBeDefined();
    expect(consoleError).toHaveBeenCalledWith(`Failed to submit session (error code ${errorCode}): XX000: internal error`);
    expect(screen.queryByRole("heading", { name: "Verify your email to certify" })).not.toBeInTheDocument();
    consoleError.mockRestore();
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

  describe("with a required item whose answers conflict", () => {
    const conflicting: ProvenanceMap = {
      pay_frequency: {
        status: "conflicting",
        source: { kind: "transcript", message_id: "m1" },
        updated_at: "2026-11-03T12:00:00Z",
        candidates: [
          { value: "Bi-weekly", source: { kind: "transcript", message_id: "m1" } },
          { value: "Weekly", source: { kind: "transcript", message_id: "m2" } },
        ],
      },
      // Only conflicts hold certification back for now; an unconfirmed item doesn't.
      company_name: { status: "inferred", source: { kind: "transcript", message_id: "m1" }, updated_at: "2026-11-03T12:00:00Z" },
    };
    const mount = (provenance: ProvenanceMap, data = DEMO_CHAMBER_DATA, verified?: ReadonlySet<string>) =>
      render(
        <MemoryRouter>
          <ReckoningTab data={data} provenance={provenance} verified={verified} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} />
        </MemoryRouter>,
      );

    it("won't submit until the prospect settles it, and says which one", () => {
      mount(conflicting);
      checkAll();
      fillSigner();
      sign();
      expect(submitButton()).toBeDisabled();
      expect(screen.getByTestId("certification-blockers")).toHaveTextContent("Before you can submit: Choose one answer for pay frequency");
    });

    // States of operation that only the census gives: the database lets it through, the browser asks first (B-2.2).
    it("names the census when its conflict is what gives the states of operation", () => {
      const census = [{ ...DEMO_CHAMBER_DATA.census[0], work_state: "OR" }];
      mount({ census: { ...conflicting.pay_frequency!, candidates: [] } }, { ...DEMO_CHAMBER_DATA, states: [], census });
      checkAll();
      fillSigner();
      sign();
      expect(submitButton()).toBeDisabled();
      expect(screen.getByTestId("certification-blockers")).toHaveTextContent("Before you can submit: Choose one answer for employee census");
      expect(screen.getByRole("alert", { name: "Answers still needed" })).toHaveTextContent("Its answers conflict, and it gives your states.");
    });

    it("still holds back a field in conflict that an advisor verified, as the database refuses it", () => {
      mount(conflicting, DEMO_CHAMBER_DATA, new Set(["pay_frequency"]));
      checkAll();
      fillSigner();
      sign();
      expect(submitButton()).toBeDisabled();
    });

    it("lets the census's states through once an advisor verified the census", () => {
      const census = [{ ...DEMO_CHAMBER_DATA.census[0], work_state: "OR" }];
      mount({ census: { ...conflicting.pay_frequency!, candidates: [] } }, { ...DEMO_CHAMBER_DATA, states: [], census }, new Set(["census"]));
      checkAll();
      fillSigner();
      sign();
      expect(submitButton()).toBeEnabled();
    });
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
  const mountWith = (certification: React.ComponentProps<typeof ReckoningTab>["certification"], peoName: string | null = null) =>
    render(
      <MemoryRouter>
        <ReckoningTab data={DEMO_CHAMBER_DATA} peoName={peoName} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} certification={certification} />
      </MemoryRouter>,
    );

  beforeEach(() => {
    auth.isAnonymous = false;
    onSubmit.mockReset().mockResolvedValue(true);
  });

  it("is read-only while nothing has changed, so it can't be certified again by accident", () => {
    mountWith({ status: "certified", submission });
    expect(screen.getByRole("status")).toHaveTextContent(/Certified by Jo Doe, CEO/);
    expect(screen.getByRole("link", { name: "View your packet" })).toHaveAttribute("href", "/manuscript/EAA-2026-S1");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText("Click to sign digitally")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate your packet/ })).not.toBeInTheDocument();
  });

  it("offers certification again once the answers have changed", () => {
    mountWith({ status: "stale", submission });
    expect(screen.getByRole("status")).toHaveTextContent(/Your answers changed after you certified/);
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Generate your packet/ })).toBeInTheDocument();
  });

  it("brings the form back if a signature made this visit is voided, even before the saved state catches up", () => {
    const tree = (d: typeof DEMO_CHAMBER_DATA, certification: React.ComponentProps<typeof ReckoningTab>["certification"]) => (
      <MemoryRouter>
        <ReckoningTab data={d} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} certification={certification} />
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
    expect(screen.getByRole("button", { name: /Generate your packet/ })).toBeDisabled();
  });

  describe("when the chosen PEO changes", () => {
    const certifiedFor = { status: "certified" as const, submission: { ...submission, peo: "Acme PEO" } };

    it("stays read-only on a fresh visit, when no PEO has been chosen yet", () => {
      mountWith(certifiedFor, null);
      expect(screen.getByRole("status")).toHaveTextContent(/Certified by Jo Doe, CEO/);
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("stays read-only when the same PEO is chosen again", () => {
      mountWith(certifiedFor, "Acme PEO");
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
      expect(screen.queryByRole("button", { name: /Generate your packet/ })).not.toBeInTheDocument();
    });

    it("asks for certification again when a different PEO is chosen, and says why", () => {
      mountWith(certifiedFor, "Other PEO");
      expect(screen.getByRole("status")).toHaveTextContent(/certified for Acme PEO/);
      expect(screen.getByRole("status")).toHaveTextContent(/Other PEO/);
      expect(screen.queryByText(/Certified by Jo Doe/)).not.toBeInTheDocument();
      expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /Generate your packet/ })).toBeInTheDocument();
    });

    it("asks for certification again when a PEO is chosen for an intake certified without one", () => {
      mountWith({ status: "certified", submission }, "Other PEO");
      expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
      expect(screen.getByRole("status")).toHaveTextContent(/You certified before choosing a PEO, and you've since chosen Other PEO/);
    });

    it("gives one reason, not two, when the answers have also changed", () => {
      mountWith({ status: "stale", submission: { ...submission, peo: "Acme PEO" } }, "Other PEO");
      // getByRole throws if more than one notice is showing.
      expect(screen.getByRole("status")).toHaveTextContent(/Your answers changed after you certified/);
      expect(screen.queryByText(/you've since chosen/)).not.toBeInTheDocument();
      expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    });

    it("hands the new PEO to the save, so certifying again records it", async () => {
      mountWith(certifiedFor, "Other PEO");
      screen.getAllByRole("checkbox").forEach((c) => fireEvent.click(c));
      fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jo Doe" } });
      fireEvent.change(screen.getByLabelText("Role"), { target: { value: "CEO" } });
      fireEvent.click(screen.getByText("Click to sign digitally"));
      fireEvent.click(screen.getByRole("button", { name: /Generate your packet/ }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ peo: "Other PEO" });
    });
  });

  it("offers certification to an intake that has never been certified", () => {
    mountWith({ status: "none" });
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Generate your packet/ })).toBeInTheDocument();
  });
});

describe("ReckoningTab required answers", () => {
  const onSubmit = vi.fn();
  const submitButton = () => screen.getByRole("button", { name: /Generate your packet/ });
  const signAndTry = () => {
    screen.getAllByRole("checkbox").forEach((c) => fireEvent.click(c));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jo Doe" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "CEO" } });
    fireEvent.click(screen.getByText("Click to sign digitally"));
    fireEvent.click(submitButton());
  };

  beforeEach(() => {
    auth.isAnonymous = false;
    onSubmit.mockReset().mockResolvedValue(true);
  });

  it("won't generate the packet while a required answer is missing, and says which", () => {
    render(
      <MemoryRouter>
        <ReckoningTab data={{ ...DEMO_CHAMBER_DATA, pay_frequency: null }} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} />
      </MemoryRouter>,
    );
    const callout = screen.getByRole("alert", { name: "Answers still needed" });
    expect(callout).toHaveTextContent("Before your packet can be generated, add:");
    expect(callout).toHaveTextContent("Pay frequency");
    expect(callout).not.toHaveTextContent("Company legal name");

    signAndTry();
    expect(submitButton()).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("certification-blockers")).toHaveTextContent("Before you can submit: Add pay frequency");
  });

  it("sends the prospect back to Review to add them", () => {
    const onReview = vi.fn();
    render(
      <MemoryRouter>
        <ReckoningTab data={{ ...DEMO_CHAMBER_DATA, company_name: null, states: [], census: [] }} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} onReview={onReview} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert", { name: "Answers still needed" })).toHaveTextContent(/Company legal name.*States of operation/);
    fireEvent.click(screen.getByRole("button", { name: "Go to Review" }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it("tells a guest too, before they verify their email", () => {
    auth.isAnonymous = true;
    render(
      <MemoryRouter>
        <ReckoningTab data={{ ...DEMO_CHAMBER_DATA, company_name: null }} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert", { name: "Answers still needed" })).toHaveTextContent("Company legal name");
  });

  const conflict = {
    status: "conflicting" as const,
    source: { kind: "transcript" as const, message_id: "m1" },
    updated_at: "2026-11-01T12:00:00Z",
    candidates: [
      { value: "Acme", source: { kind: "transcript" as const, message_id: "m1" } },
      { value: "Acme LLC", source: { kind: "document" as const, document_id: "d1" } },
    ],
  };

  it("won't generate the packet while a required answer has two different values, and says which", () => {
    render(
      <MemoryRouter>
        <ReckoningTab data={DEMO_CHAMBER_DATA} provenance={{ company_name: conflict, industry: conflict }} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} />
      </MemoryRouter>,
    );
    const callout = screen.getByRole("alert", { name: "Answers still needed" });
    expect(callout).toHaveTextContent("Before your packet can be generated, choose one answer for:");
    expect(callout).toHaveTextContent("Company legal name");
    // A recommended field in conflict is for Review, not a blocker.
    expect(callout).not.toHaveTextContent("Industry");

    signAndTry();
    expect(submitButton()).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("certification-blockers")).toHaveTextContent("Before you can submit: Choose one answer for company legal name");
  });

  it("names missing answers and conflicts together", () => {
    render(
      <MemoryRouter>
        <ReckoningTab data={{ ...DEMO_CHAMBER_DATA, pay_frequency: null }} provenance={{ states: conflict }} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} />
      </MemoryRouter>,
    );
    const callout = screen.getByRole("alert", { name: "Answers still needed" });
    expect(callout).toHaveTextContent(/add:.*Pay frequency.*And choose one answer for:.*States of operation/);
  });

  it("lets a settled conflict be certified", () => {
    render(
      <MemoryRouter>
        <ReckoningTab data={DEMO_CHAMBER_DATA} provenance={{ company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-11-01T12:00:00Z" }, industry: conflict }} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("alert", { name: "Answers still needed" })).not.toBeInTheDocument();
    signAndTry();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("says nothing when every required answer is there, census or not", () => {
    render(
      <MemoryRouter>
        <ReckoningTab data={{ ...DEMO_CHAMBER_DATA, census: [] }} peoName={null} sessionId="s1" fileId="EAA-2026-S1" onSubmit={onSubmit} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("alert", { name: "Answers still needed" })).not.toBeInTheDocument();
    signAndTry();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
