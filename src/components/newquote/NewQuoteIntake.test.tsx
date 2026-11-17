import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// New quote step 2, the intake with Lenore (CRM-Q2.2, slice 5.5; D-1870..D-1879), and step 3's waiting line (CRM-Q2.4's first AC). The chamber and the submission page are tested on their own;
// here they are stand-ins that show what New quote gave them. The database is faked at its API modules.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const getOpportunityPage = vi.fn();
vi.mock("@/lib/opportunityPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/opportunityPageApi")), getOpportunityPage: (...a: unknown[]) => getOpportunityPage(...a) }));
const brokerIntake = { startBrokerIntake: vi.fn(), inviteClient: vi.fn(), remindClient: vi.fn(), fetchIntakeInviteStatus: vi.fn() };
vi.mock("@/lib/brokerIntake", async () => ({ ...(await vi.importActual<object>("@/lib/brokerIntake")), ...brokerIntake }));
vi.mock("@/pages/ChamberPage", () => ({
  default: ({ intakeId, embedded }: { intakeId?: string; embedded?: boolean }) => <div data-testid="chamber">{`${intakeId ?? "none"}|${embedded ? "embedded" : "page"}`}</div>,
}));
vi.mock("@/pages/advisor/AdvisorSubmissionPage", () => ({ default: () => <div data-testid="submission-page" /> }));

const { NewQuoteDialog } = await import("./NewQuoteDialog");

const onClose = vi.fn();
const page = (over: Record<string, unknown> = {}) => ({
  opportunity: { id: "o1", name: "January 2028 PEO search", stage: "qualifying", submissionId: null },
  account: { id: "a1", name: "Harborview Dental Group", archived: false },
  owner: null,
  mainContact: { id: "c1", name: "Lucia Torres" },
  canChange: true,
  canAdd: true,
  quotes: [],
  intake: null,
  contacts: [{ id: "c1", name: "Lucia Torres", title: null, email: "lucia@harborview.example", phone: null, main: true, fillsInIntake: false }],
  ...over,
});
const draftIntake = (over: Record<string, unknown> = {}) => ({
  submissionId: "i1", fileId: null, pipelineStatus: "draft", certifiedBy: null, certifiedAt: null, version: null, censusSize: null, answered: 3, prospectName: null,
  openItems: { count: 2, firstLabel: null, firstField: null }, ...over,
});

const open = async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NewQuoteDialog firmId="f1" person="Dana Reyes" opportunityId="o1" onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const dialog = await screen.findByRole("dialog", { name: "New quote" });
  return { user, dialog };
};

beforeEach(() => {
  for (const m of [getOpportunityPage, onClose, ...Object.values(brokerIntake)]) m.mockReset();
  brokerIntake.fetchIntakeInviteStatus.mockResolvedValue({ state: "none" });
});

describe("New quote step 2 starts the intake (CRM-Q2.2, D-1872)", () => {
  // Break caught: an opportunity with no intake shows only its saved summary, so the agent has no way to begin the intake from New quote and must leave for /start.
  it("starts the opportunity's intake from Start the intake", async () => {
    getOpportunityPage.mockResolvedValue(page());
    brokerIntake.startBrokerIntake.mockResolvedValue({ intakeId: "i1" });
    const { user, dialog } = await open();
    await user.click(await within(dialog).findByRole("button", { name: "Start the intake" }));
    expect(brokerIntake.startBrokerIntake).toHaveBeenCalledWith("o1");
  });

  // Break caught: after the intake is made the dialog still shows "Start the intake" (the opportunity is not read again), or opens nothing, so the agent sees no Lenore and no tabs.
  it("then opens the chamber for that intake, inside the dialog", async () => {
    getOpportunityPage.mockResolvedValueOnce(page()).mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.startBrokerIntake.mockResolvedValue({ intakeId: "i1" });
    const { user, dialog } = await open();
    await user.click(await within(dialog).findByRole("button", { name: "Start the intake" }));
    expect(await within(dialog).findByTestId("chamber")).toHaveTextContent("i1|embedded");
    expect(within(dialog).queryByRole("button", { name: "Start the intake" })).not.toBeInTheDocument();
  });
});

describe("The room the intake gets (CRM-Q2.2, D-1872)", () => {
  // Break caught: Lenore and the ten tabs are squeezed into the account step's narrow dialog (max-w-2xl), so the two sides of the intake cannot sit side by side.
  it("widens the dialog while the chamber is open, and keeps the narrow one for the summary", async () => {
    getOpportunityPage.mockResolvedValue(page());
    const { dialog } = await open();
    await within(dialog).findByRole("button", { name: "Start the intake" });
    expect(dialog).toHaveClass("max-w-2xl");
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.startBrokerIntake.mockResolvedValue({ intakeId: "i1" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Start the intake" }));
    await within(dialog).findByTestId("chamber");
    expect(dialog).toHaveClass("max-w-[95vw]", "h-[90vh]");
    expect(dialog).not.toHaveClass("max-w-2xl");
  });
});

describe("Invite the contact to finish and certify (CRM-Q2.2, D-1873)", () => {
  // Break caught: the agent can type answers but has no way to hand the intake to the contact from New quote, or the invitation goes to an address typed nowhere (the contact's own is the default).
  it("sends the invitation to the contact's email, which the form offers", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.inviteClient.mockResolvedValue({ invitationId: "inv1", delivery: "sent" });
    const { user, dialog } = await open();
    await user.click(await within(dialog).findByRole("button", { name: "Invite the contact to finish and certify" }));
    expect(within(dialog).getByLabelText("Contact's email")).toHaveValue("lucia@harborview.example");
    await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    expect(brokerIntake.inviteClient).toHaveBeenCalledWith({ intakeId: "i1", email: "lucia@harborview.example", name: "Lucia Torres" });
  });

  // Break caught: "The contact does it all" asks for entries first, or sends nothing until a form is filled; it is the same link, sent at once to the contact, with nothing typed (D-1755).
  it("The contact does it all sends the same invitation at once, with nothing entered", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake({ answered: 0 }) }));
    brokerIntake.inviteClient.mockResolvedValue({ invitationId: "inv1", delivery: "sent" });
    const { user, dialog } = await open();
    await user.click(await within(dialog).findByRole("button", { name: "The contact does it all" }));
    expect(brokerIntake.inviteClient).toHaveBeenCalledWith({ intakeId: "i1", email: "lucia@harborview.example", name: "Lucia Torres" });
  });

  // Break caught: "The contact does it all" for a contact with no email sends to a blank address (the database refuses it in words the agent never sees) instead of asking for the address.
  it("asks for the email first when the main contact has none", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake(), contacts: [{ id: "c1", name: "Lucia Torres", title: null, email: null, phone: "555-0100", main: true, fillsInIntake: false }] }));
    const { user, dialog } = await open();
    await user.click(await within(dialog).findByRole("button", { name: "The contact does it all" }));
    expect(brokerIntake.inviteClient).not.toHaveBeenCalled();
    expect(within(dialog).getByLabelText("Contact's email")).toHaveValue("");
  });
});

const waiting = (over: Record<string, unknown> = {}) => ({
  state: "waiting", email: "lucia@harborview.example", contactName: "Lucia Torres", invitedAt: new Date("2026-11-14T12:00:00Z"), lastOpenedAt: null,
  expiresAt: new Date("2026-11-28T12:00:00Z"), sendCount: 1, acceptedAt: null, delivery: "sent", ...over,
});

describe("Step 3 before the employer certifies: waiting (CRM-Q2.4, D-1771, D-1874)", () => {
  // Break caught: an invited intake shows the invite buttons again, or says nothing of who the quote waits for and since when, so the agent cannot tell whether to chase.
  it("reads Waiting for the contact to certify, with when they were invited and that they have not opened it", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.fetchIntakeInviteStatus.mockResolvedValue(waiting());
    const { dialog } = await open();
    expect(await within(dialog).findByText("Waiting for Lucia to certify")).toBeInTheDocument();
    expect(within(dialog).getByText(/Invited Nov 1[34], 2026/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Not opened yet/)).toBeInTheDocument();
    expect(brokerIntake.fetchIntakeInviteStatus).toHaveBeenCalledWith("i1");
    expect(within(dialog).queryByRole("button", { name: "The contact does it all" })).not.toBeInTheDocument();
  });

  // Break caught: the line always says "Not opened yet", so an agent chases a contact who has already opened the link.
  it("says when the contact last opened it", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.fetchIntakeInviteStatus.mockResolvedValue(waiting({ lastOpenedAt: new Date("2026-11-16T12:00:00Z") }));
    const { dialog } = await open();
    expect(await within(dialog).findByText(/Last opened Nov 1[67], 2026/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Not opened yet/)).not.toBeInTheDocument();
  });

  // Break caught: the invite buttons show for a moment before the invitation's state is read, so an agent clicks an invitation again for an intake already invited (the database refuses it, but the agent is left confused).
  it("offers no invitation until it has read whether one was sent", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.fetchIntakeInviteStatus.mockReturnValue(new Promise(() => undefined));
    const { dialog } = await open();
    await within(dialog).findByTestId("chamber");
    expect(within(dialog).queryByRole("button", { name: "The contact does it all" })).not.toBeInTheDocument();
  });
});

describe("After the invitation is sent (CRM-Q2.2, CRM-Q2.4, D-1874)", () => {
  // Break caught: after inviting, the dialog keeps offering to invite (the state is not read again), so the agent can't see that the quote now waits for the contact.
  it("turns the invitation into the waiting line", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.fetchIntakeInviteStatus.mockResolvedValueOnce({ state: "none" }).mockResolvedValue(waiting());
    brokerIntake.inviteClient.mockResolvedValue({ invitationId: "inv1", delivery: "sent" });
    const { user, dialog } = await open();
    await user.click(await within(dialog).findByRole("button", { name: "The contact does it all" }));
    expect(await within(dialog).findByText("Waiting for Lucia to certify")).toBeInTheDocument();
  });
});

describe("When the invitation is refused (CRM-Q2.2, D-1874)", () => {
  // Break caught: a refused invitation (a bad address, a closing firm) does nothing the agent can see: the database's words are lost and the button seems dead.
  it("shows the reason in the words it was given, and keeps the form", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.inviteClient.mockRejectedValue(new Error("Check the email address"));
    const { user, dialog } = await open();
    await user.click(await within(dialog).findByRole("button", { name: "Invite the contact to finish and certify" }));
    await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Check the email address");
    expect(within(dialog).getByLabelText("Contact's email")).toBeInTheDocument();
  });
});

describe("The waiting line when the link did not reach or has lapsed (CRM-Q2.4, D-1874)", () => {
  // Break caught: an invitation whose email failed to send reads as a normal wait, so the agent waits for a contact who never got the link.
  it("says the email did not go out, so Remind is the next step", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.fetchIntakeInviteStatus.mockResolvedValue(waiting({ delivery: "failed" }));
    const { dialog } = await open();
    expect(await within(dialog).findByText("The email didn't go out. Remind sends it again.")).toBeInTheDocument();
  });
});

describe("The waiting line when the link has lapsed (CRM-Q2.4, D-1874)", () => {
  // Break caught: a link past its 14 days reads as a live wait, so the agent waits on a link that no longer opens instead of pressing Remind.
  it("says the link expired, and Remind sends a new one", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.fetchIntakeInviteStatus.mockResolvedValue(waiting({ state: "expired" }));
    const { dialog } = await open();
    expect(await within(dialog).findByText(/The link expired Nov 2[78], 2026, .*\. Remind sends a new one\./)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Remind" })).toBeInTheDocument();
  });
});

describe("Remind (CRM-Q2.4, D-1711, D-1874)", () => {
  // Break caught: the waiting line has no way to chase the contact from New quote, or Remind sends a first invitation (to a typed address) instead of the fresh link that replaces the old one.
  it("sends a fresh link for the intake and says so, then reads the state again", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: draftIntake() }));
    brokerIntake.fetchIntakeInviteStatus.mockResolvedValueOnce(waiting()).mockResolvedValue(waiting({ sendCount: 2 }));
    brokerIntake.remindClient.mockResolvedValue({ invitationId: "inv2", delivery: "sent" });
    const { user, dialog } = await open();
    await user.click(await within(dialog).findByRole("button", { name: "Remind" }));
    expect(brokerIntake.remindClient).toHaveBeenCalledWith("i1");
    expect(await within(dialog).findByText("Reminder sent to Lucia.")).toBeInTheDocument();
    expect(brokerIntake.fetchIntakeInviteStatus).toHaveBeenCalledTimes(2);
  });
});
