import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toast.success(...a), error: (...a: unknown[]) => toast.error(...a) } }));
const createOpportunity = vi.fn();
const getNewOpportunityContext = vi.fn();
vi.mock("@/lib/opportunityCreateApi", async () => {
  const real = await vi.importActual<typeof import("@/lib/opportunityCreateApi")>("@/lib/opportunityCreateApi");
  return { ...real, createOpportunity: (...a: unknown[]) => createOpportunity(...a), getNewOpportunityContext: (...a: unknown[]) => getNewOpportunityContext(...a) };
});

const { NewOpportunityDialog } = await import("./NewOpportunityDialog");
const { OpportunityError } = await import("@/lib/opportunityCreateApi");

// The words of opportunity_create's owner rule (20261120130000), the one 42501 that is about the Owner field.
const OWNER_RULE_MESSAGE = "You can make an opportunity only for yourself and, as a lead, for people on your teams.";

const context = (over: Record<string, unknown> = {}) => ({
  account: { id: "a1", name: "Harborview Dental Group", archived: false, employees: 45 },
  mainContact: { id: "c1", name: "Elena Marsh" },
  contacts: [{ id: "c1", name: "Elena Marsh", title: "Practice Manager", isMain: true }, { id: "c2", name: "Owen Park", title: null, isMain: false }],
  partners: [{ code: "acme-cfo", name: "Acme CFO" }],
  owners: [{ id: "u1", name: "Dana Reyes" }, { id: "u2", name: "Marcus Hale" }],
  ...over,
});

const onClose = vi.fn();
const onCreated = vi.fn();
const onRenewalTaken = vi.fn();

const open = async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NewOpportunityDialog firmId="f1" accountId="a1" onClose={onClose} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  const dialog = await screen.findByRole("dialog", { name: "New opportunity" });
  await within(dialog).findByLabelText("Opportunity name");
  return { user, dialog };
};
const field = (dialog: HTMLElement, label: string | RegExp) => within(dialog).getByLabelText(label);

beforeEach(() => {
  for (const m of [createOpportunity, getNewOpportunityContext, onClose, onCreated, onRenewalTaken, toast.success, toast.error]) m.mockReset();
  getNewOpportunityContext.mockResolvedValue(context());
  createOpportunity.mockResolvedValue({ id: "o1", version: 1, stage: "qualifying" });
});

describe("the New opportunity form (screen 25)", () => {
  // Catches: a field of the story missing, the account not filled in and read-only (D-436), the stage not shown as Qualifying and fixed (D-409), the employees and
  // main contact not offered from the account (D-438), the owner not the person by default, or a button of a later epic shown (D-402, D-441).
  it("opens with the story's fields, the account read-only, Qualifying fixed, and the account's employees and main contact offered", async () => {
    const { dialog } = await open();
    expect(within(dialog).getByText("On Harborview Dental Group")).toBeInTheDocument();
    for (const label of ["Opportunity name", "Account", "Target start date", "Employees in this search", "Main contact", "Expected close date", "Value, a year", "Source", "Stage", "Owner", "Next step"]) {
      expect(field(dialog, label)).toBeInTheDocument();
    }
    expect(field(dialog, "Account")).toHaveValue("Harborview Dental Group");
    expect(field(dialog, "Account")).toBeDisabled();
    expect(field(dialog, "Stage")).toBeDisabled();
    expect(field(dialog, "Stage")).toHaveDisplayValue("Qualifying");
    expect(field(dialog, "Employees in this search")).toHaveValue("45");
    expect(field(dialog, "Main contact")).toHaveValue("c1");
    expect(field(dialog, "Main contact")).toHaveDisplayValue("Elena Marsh, Practice Manager");
    await waitFor(() => expect(field(dialog, "Owner")).toHaveValue("u1"));
    expect(within(dialog).getByText("Required")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button").map((b) => b.textContent).filter((t) => /Cancel|Save/.test(t ?? ""))).toEqual(["Cancel", "Save opportunity"]);
    expect(within(dialog).queryByText(/start the quote/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/last year/i)).not.toBeInTheDocument();
  });

  // Catches: the name not offered from the target start in the story's words, not kept in step as the start changes, or overwriting a name the person typed.
  it("offers '<Month YYYY> PEO search' from the target start, keeps it in step, and stops once the person types in the name", async () => {
    const { user, dialog } = await open();
    expect(field(dialog, "Opportunity name")).toHaveValue("PEO search");
    await user.type(field(dialog, "Target start date"), "2028-01-01");
    expect(field(dialog, "Opportunity name")).toHaveValue("January 2028 PEO search");
    await user.clear(field(dialog, "Target start date"));
    await user.type(field(dialog, "Target start date"), "2027-03-15");
    expect(field(dialog, "Opportunity name")).toHaveValue("March 2027 PEO search");
    await user.type(field(dialog, "Opportunity name"), " (West)");
    expect(field(dialog, "Opportunity name")).toHaveValue("March 2027 PEO search (West)");
    await user.clear(field(dialog, "Target start date"));
    await user.type(field(dialog, "Target start date"), "2029-06-01");
    expect(field(dialog, "Opportunity name")).toHaveValue("March 2027 PEO search (West)");
  });

  // Catches: no way to start a workers' comp search from the form, or the choice made on screen and dropped before the save.
  it("asks what is being quoted, a PEO unless the person chooses workers' comp, and saves the choice", async () => {
    const { user, dialog } = await open();
    const line = field(dialog, "What is being quoted");
    expect(line).toHaveValue("peo");
    expect(within(line as HTMLElement).getAllByRole("option").map((o) => o.textContent)).toEqual(["PEO", "Workers' comp"]);
    await user.selectOptions(line, "workers_comp");
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    await waitFor(() => expect(createOpportunity).toHaveBeenCalledTimes(1));
    expect(createOpportunity.mock.calls[0][2]).toMatchObject({ line: "workers_comp" });
  });

  // Catches: a workers' comp search saved under the name "PEO search" because the offered name ignored the choice, or a name the person typed replaced by it.
  it("offers the name of the chosen line's search, keeps it in step with the choice and the start, and stops once the person types in the name", async () => {
    const { user, dialog } = await open();
    await user.selectOptions(field(dialog, "What is being quoted"), "workers_comp");
    expect(field(dialog, "Opportunity name")).toHaveValue("Workers' comp search");
    await user.type(field(dialog, "Target start date"), "2027-03-15");
    expect(field(dialog, "Opportunity name")).toHaveValue("March 2027 workers' comp search");
    await user.selectOptions(field(dialog, "What is being quoted"), "peo");
    expect(field(dialog, "Opportunity name")).toHaveValue("March 2027 PEO search");
    await user.type(field(dialog, "Opportunity name"), " (West)");
    await user.selectOptions(field(dialog, "What is being quoted"), "workers_comp");
    expect(field(dialog, "Opportunity name")).toHaveValue("March 2027 PEO search (West)");
  });

  // Catches: a form saved with no name, a value that is not dollars, or a request sent for a form that is not right.
  it("will not save without a name, or with a value that isn't dollars, and says why in words", async () => {
    const { user, dialog } = await open();
    await user.clear(field(dialog, "Opportunity name"));
    await user.type(field(dialog, "Value, a year"), "lots");
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    expect(await within(dialog).findByText("Give the opportunity a name.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter dollars, like $7,100. A value can't be negative.")).toBeInTheDocument();
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  // Catches: what was typed not sent (or sent untrimmed or as text), the stage sent, the owner dropped, the form left open, the new page not opened (D-442) or the
  // account's lists not told.
  it("saves what was typed on the account, then tells the page which opportunity was made", async () => {
    const { user, dialog } = await open();
    await user.clear(field(dialog, "Opportunity name"));
    await user.type(field(dialog, "Opportunity name"), "  January 2028 renewal ");
    await user.type(field(dialog, "Target start date"), "2028-01-01");
    await user.selectOptions(field(dialog, "Main contact"), "c2");
    await user.type(field(dialog, "Expected close date"), "2027-12-10");
    await user.type(field(dialog, "Value, a year"), "$7,100");
    await user.selectOptions(field(dialog, "Source"), "Renewal");
    await waitFor(() => expect(field(dialog, "Owner")).toHaveValue("u1"));
    await user.selectOptions(field(dialog, "Owner"), "u2");
    await user.type(field(dialog, "Next step"), " Ask Elena whether headcount changed. ");
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: "o1", version: 1, stage: "qualifying" }));
    expect(createOpportunity).toHaveBeenCalledWith("f1", "a1", {
      name: "January 2028 renewal", targetStart: "2028-01-01", employees: 45, mainContactId: "c2", expectedClose: "2027-12-10", value: 7100, source: "Renewal",
      referralPartnerCode: null, nextStep: "Ask Elena whether headcount changed.", ownerId: "u2", renewalId: null, line: "peo",
    });
    expect(toast.success).toHaveBeenCalledWith("Opportunity created");
  });

  // Catches: the partner asked for a source that is not Referral, not asked for Referral, sent with another source after being chosen (the database refuses a
  // partner with any other source), or not sent at all.
  it("asks which referral partner only for a Referral, and sends it only then", async () => {
    const { user, dialog } = await open();
    expect(within(dialog).queryByLabelText("Referral partner")).not.toBeInTheDocument();
    await user.selectOptions(field(dialog, "Source"), "Referral");
    await user.selectOptions(field(dialog, "Referral partner"), "acme-cfo");
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    await waitFor(() => expect(createOpportunity).toHaveBeenCalledTimes(1));
    expect(createOpportunity.mock.calls[0][2]).toMatchObject({ source: "Referral", referralPartnerCode: "acme-cfo" });
    createOpportunity.mockClear();
    await user.selectOptions(field(dialog, "Source"), "Inbound");
    expect(within(dialog).queryByLabelText("Referral partner")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    await waitFor(() => expect(createOpportunity).toHaveBeenCalledTimes(1));
    expect(createOpportunity.mock.calls[0][2]).toMatchObject({ source: "Inbound", referralPartnerCode: null });
  });

  // Catches: no say for a firm with no referral partners (the box would offer nothing), or a Source list other than the story's.
  it("offers the story's sources, and no partner box when the firm has no partners", async () => {
    getNewOpportunityContext.mockResolvedValue(context({ partners: [] }));
    const { user, dialog } = await open();
    expect(within(field(dialog, "Source")).getAllByRole("option").map((o) => o.textContent)).toEqual(["No source", "Referral", "Renewal", "Existing client", "Inbound", "Outbound", "Event", "Other"]);
    await user.selectOptions(field(dialog, "Source"), "Referral");
    expect(within(dialog).queryByLabelText("Referral partner")).not.toBeInTheDocument();
  });

  // Catches: a refusal of the database shown nowhere, or an owner the person may not choose not shown beside Owner, or what was typed lost.
  it("shows the database's refusal in words, under the field it is about, and keeps what was typed", async () => {
    createOpportunity.mockRejectedValueOnce(new OpportunityError("notAllowed", "You can make an opportunity only for yourself and, as a lead, for people on your teams.", "42501"));
    const { user, dialog } = await open();
    await user.type(field(dialog, "Next step"), "Call back");
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    expect(await within(dialog).findByText("You can make an opportunity only for yourself and, as a lead, for people on your teams.")).toBeInTheDocument();
    expect(field(dialog, "Next step")).toHaveValue("Call back");
    expect(onCreated).not.toHaveBeenCalled();
    createOpportunity.mockRejectedValueOnce(new OpportunityError("archived", "This account is archived. Nothing can be added to it.", "55000"));
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    expect(await within(dialog).findByText("This account is archived. Nothing can be added to it.")).toBeInTheDocument();
  });

  // Catches: any 42501 put under Owner: a removed member's "not a member" refusal is about the whole form, and shown beside Owner it sends the person to a field
  // they cannot fix. Only the owner rule's words belong beside Owner.
  it("shows a 42501 that is not the owner rule for the whole form, not under Owner", async () => {
    const { user, dialog } = await open();
    createOpportunity.mockRejectedValueOnce(new OpportunityError("notAllowed", "Not a member of that firm", "42501"));
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    expect(await within(dialog).findByText("Not a member of that firm")).toBeInTheDocument();
    expect(field(dialog, "Owner")).not.toHaveAttribute("aria-invalid", "true");
    expect(field(dialog, "Owner")).not.toHaveAccessibleDescription(/Not a member/);
    createOpportunity.mockRejectedValueOnce(new OpportunityError("notAllowed", OWNER_RULE_MESSAGE, "42501"));
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    await waitFor(() => expect(field(dialog, "Owner")).toHaveAttribute("aria-invalid", "true"));
    expect(field(dialog, "Owner")).toHaveAccessibleDescription(OWNER_RULE_MESSAGE);
  });

  // Catches: a form over an account that cannot be read (it would save to nothing), or one that does not say an archived account takes none.
  it("does not show the form when the account can't be read, or says an archived account takes none", async () => {
    getNewOpportunityContext.mockRejectedValueOnce(new OpportunityError("failed", "Couldn't load the account."));
    const user = userEvent.setup();
    const { unmount } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><NewOpportunityDialog firmId="f1" accountId="a1" onClose={onClose} onCreated={onCreated} /></QueryClientProvider>);
    const dialog = await screen.findByRole("dialog", { name: "New opportunity" });
    expect(await within(dialog).findByText("Couldn't load the account.")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Opportunity name")).not.toBeInTheDocument();
    getNewOpportunityContext.mockResolvedValueOnce(context());
    await user.click(within(dialog).getByRole("button", { name: "Try again" }));
    expect(await within(dialog).findByLabelText("Opportunity name")).toBeInTheDocument();
    unmount();
    getNewOpportunityContext.mockResolvedValue(context({ account: { id: "a1", name: "Harborview Dental Group", archived: true, employees: 45 } }));
    render(<QueryClientProvider client={new QueryClient()}><NewOpportunityDialog firmId="f1" accountId="a1" onClose={onClose} onCreated={onCreated} /></QueryClientProvider>);
    expect(await screen.findByText("This account is archived. Nothing can be added to it.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Opportunity name")).not.toBeInTheDocument();
  });

  // Catches: Cancel losing what was typed without asking, or not closing a form nobody touched.
  it("closes at once when nothing was typed, and asks first when something was", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.type(field(dialog, "Next step"), "x");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: /Discard/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});

describe("Start the renewal (the form filled in, D-449)", () => {
  const openRenewal = async (renewsOn = "2027-01-01") => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NewOpportunityDialog firmId="f1" accountId="a1" renewal={{ id: "r1", renewsOn }} onClose={onClose} onCreated={onCreated} onRenewalTaken={onRenewalTaken} />
      </QueryClientProvider>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Start the renewal" });
    await within(dialog).findByLabelText("Opportunity name");
    return { user, dialog };
  };

  // Catches: the form not filled in as D-449 says (name "<Month YYYY> renewal" from the renewal's date, target start that date, source Renewal, employees and main
  // contact from the account), so the person retypes what the renewal already knows.
  it("opens with the renewal's name, date and source, and the account's employees and main contact", async () => {
    const { dialog } = await openRenewal();
    expect(field(dialog, "Opportunity name")).toHaveValue("January 2027 renewal");
    expect(field(dialog, "Target start date")).toHaveValue("2027-01-01");
    expect(field(dialog, "Source")).toHaveValue("Renewal");
    expect(field(dialog, "Employees in this search")).toHaveValue("45");
    expect(field(dialog, "Main contact")).toHaveValue("c1");
  });

  // Catches: the save not carrying the renewal (the opportunity is then made and never linked), or the renewal sent with the form's other fields lost.
  it("saves with the renewal's id, and tells the page which opportunity was made", async () => {
    const { user, dialog } = await openRenewal();
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: "o1", version: 1, stage: "qualifying" }));
    expect(createOpportunity).toHaveBeenCalledWith("f1", "a1", expect.objectContaining({ renewalId: "r1", source: "Renewal", targetStart: "2027-01-01", name: "January 2027 renewal", employees: 45, mainContactId: "c1" }));
  });

  // Catches: the name following the target start as a PEO search ("January 2027 PEO search") on a renewal, or going on following it after the person typed their own.
  it("keeps the name in step with the date as a renewal's name until the person types one", async () => {
    const { user, dialog } = await openRenewal();
    await user.clear(field(dialog, "Target start date"));
    await user.type(field(dialog, "Target start date"), "2027-03-15");
    expect(field(dialog, "Opportunity name")).toHaveValue("March 2027 renewal");
    await user.type(field(dialog, "Opportunity name"), " for Harborview");
    await user.clear(field(dialog, "Target start date"));
    await user.type(field(dialog, "Target start date"), "2027-04-01");
    expect(field(dialog, "Opportunity name")).toHaveValue("March 2027 renewal for Harborview");
  });

  // Catches: a renewal renamed "Workers' comp search" when the person says what it quotes: a renewal's name is its own, whatever the line (ADR 0029).
  it("keeps the renewal's name when what is being quoted is changed, and saves the choice", async () => {
    const { user, dialog } = await openRenewal();
    await user.selectOptions(field(dialog, "What is being quoted"), "workers_comp");
    expect(field(dialog, "Opportunity name")).toHaveValue("January 2027 renewal");
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    await waitFor(() => expect(createOpportunity).toHaveBeenCalledWith("f1", "a1", expect.objectContaining({ renewalId: "r1", name: "January 2027 renewal", line: "workers_comp" })));
  });

  // Catches: a renewal someone else started meanwhile refused with a generic failure, or the form closed (the person then loses what they typed).
  it("says the database's words when the renewal is already being worked, and stays open", async () => {
    createOpportunity.mockRejectedValue(new OpportunityError("renewalTaken", "Its renewal is being worked by January 2027 renewal", "PT409"));
    const { user, dialog } = await openRenewal();
    await user.click(within(dialog).getByRole("button", { name: "Save opportunity" }));
    expect(await within(dialog).findByText("Its renewal is being worked by January 2027 renewal")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // The page is told, so it asks for the renewals again and the stale link goes (D-449).
    expect(onRenewalTaken).toHaveBeenCalledTimes(1);
  });

  // Catches: the Source of a started renewal left as a choice (D-439: it is Renewal; the database refuses any other), so a person picks another and the save is refused.
  it("holds the Source to Renewal: it is not a choice", async () => {
    const { dialog } = await openRenewal();
    expect(field(dialog, "Source")).toBeDisabled();
    expect(field(dialog, "Source")).toHaveValue("Renewal");
  });

  // Catches: the hold on Source reaching an ordinary New opportunity, where Source is a free choice (D-438).
  it("leaves Source a choice on an ordinary New opportunity", async () => {
    const { dialog } = await open();
    expect(field(dialog, "Source")).toBeEnabled();
  });
});
