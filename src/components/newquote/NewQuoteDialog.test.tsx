import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toast.success(...a), error: (...a: unknown[]) => toast.error(...a) } }));

const searchRecords = vi.fn();
vi.mock("@/lib/searchApi", async () => ({ ...(await vi.importActual<object>("@/lib/searchApi")), searchRecords: (...a: unknown[]) => searchRecords(...a) }));

const getNewOpportunityContext = vi.fn();
const listAccountTab = vi.fn();
vi.mock("@/lib/accountPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountPageApi")), listAccountTab: (...a: unknown[]) => listAccountTab(...a) }));

const createAccount = vi.fn();
vi.mock("@/lib/accountCreateApi", async () => ({ ...(await vi.importActual<object>("@/lib/accountCreateApi")), createAccount: (...a: unknown[]) => createAccount(...a) }));
const addContact = vi.fn();
vi.mock("@/lib/contactApi", async () => ({ ...(await vi.importActual<object>("@/lib/contactApi")), addContact: (...a: unknown[]) => addContact(...a) }));
const createOpportunity = vi.fn();
vi.mock("@/lib/opportunityCreateApi", async () => ({
  ...(await vi.importActual<object>("@/lib/opportunityCreateApi")),
  getNewOpportunityContext: (...a: unknown[]) => getNewOpportunityContext(...a),
  createOpportunity: (...a: unknown[]) => createOpportunity(...a),
}));

const getOpportunityPage = vi.fn();
vi.mock("@/lib/opportunityPageApi", async () => ({ ...(await vi.importActual<object>("@/lib/opportunityPageApi")), getOpportunityPage: (...a: unknown[]) => getOpportunityPage(...a) }));
const checkAccountDuplicates = vi.fn();
vi.mock("@/lib/duplicateApi", async () => ({ ...(await vi.importActual<object>("@/lib/duplicateApi")), checkAccountDuplicates: (...a: unknown[]) => checkAccountDuplicates(...a) }));

// The submission page is tested on its own (AdvisorSubmissionPage.test.tsx); here it is a stand-in that shows what the dialog gave it.
vi.mock("@/pages/advisor/AdvisorSubmissionPage", () => ({
  default: ({ submissionId, embedded }: { submissionId?: string; embedded?: boolean }) => <div data-testid="submission-page">{`${submissionId ?? "none"}|${embedded ? "embedded" : "page"}`}</div>,
}));

const { NewQuoteDialog } = await import("./NewQuoteDialog");

const onClose = vi.fn();
const context = () => ({
  account: { id: "a1", name: "Harborview Dental Group", archived: false, employees: 45 },
  mainContact: { id: "c1", name: "Elena Marsh" },
  contacts: [{ id: "c1", name: "Elena Marsh", title: "Practice Manager", isMain: true }, { id: "c2", name: "Owen Park", title: null, isMain: false }],
  partners: [],
  owners: [{ id: "u1", name: "Dana Reyes" }],
});
const opportunity = (id: string, name: string, stage: string) => ({ id, name, stage, targetStart: null, submissionId: null });
const account = (id: string, name: string, over: Record<string, unknown> = {}) => ({ kind: "account", id, name, tradeName: null, webDomain: null, phone: null, city: "Gresham", state: "OR", archived: false, ...over });
const found = (accounts: ReturnType<typeof account>[]) => ({
  query: "",
  accounts: { rows: accounts, more: false },
  contacts: { rows: [], more: false },
  opportunities: { rows: [], more: false },
  quotes: { rows: [], more: false },
});

const open = async (props: Record<string, unknown> = {}) => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NewQuoteDialog firmId="f1" person="Dana Reyes" onClose={onClose} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const dialog = await screen.findByRole("dialog", { name: "New quote" });
  return { user, dialog };
};

beforeEach(() => {
  for (const m of [searchRecords, getNewOpportunityContext, listAccountTab, createAccount, addContact, createOpportunity, checkAccountDuplicates, getOpportunityPage, onClose, toast.success, toast.error]) m.mockReset();
  searchRecords.mockResolvedValue(found([]));
  getNewOpportunityContext.mockResolvedValue(context());
  listAccountTab.mockResolvedValue({ count: 0, rows: [] });
});

describe("New quote is step 1 only (founder's direction, D-1763)", () => {
  // Catches: a steps bar or step 2 to 4 screens of New quote's own (the intake is the existing /start chamber, opened later for the opportunity), or a Continue that leads nowhere (D-402).
  it("shows the account step and Save and close, with no steps bar and no Continue", async () => {
    const { dialog } = await open();
    expect(within(dialog).queryByRole("list", { name: "Steps" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/not available yet/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Business name")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save and close" })).toBeInTheDocument();
  });
});

const page = (over: Record<string, unknown> = {}) => ({
  opportunity: { id: "o1", name: "January 2028 PEO search", stage: "qualifying" },
  account: { id: "a1", name: "Harborview Dental Group", archived: false },
  owner: null,
  mainContact: { id: "c1", name: "Elena Marsh" },
  canChange: true,
  canAdd: true,
  quotes: [],
  intake: null,
  contacts: [],
  ...over,
});

describe("New quote opened on an opportunity (D-1709)", () => {
  // Catches: the flow opened at an opportunity's own address asking for the account again, or drawing a steps bar or a "next step" the chamber is meant to supply.
  it("shows the account, contact and opportunity as saved, with Save and close, and nothing of steps 2 to 4", async () => {
    getOpportunityPage.mockResolvedValue(page());
    const { dialog } = await open({ opportunityId: "o1" });
    expect(await within(dialog).findByText("Harborview Dental Group")).toBeInTheDocument();
    expect(within(dialog).getByText("January 2028 PEO search")).toBeInTheDocument();
    expect(within(dialog).getByText("Elena Marsh")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Business name")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("list", { name: "Steps" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/not available yet|Next:/i)).not.toBeInTheDocument();
    expect(getOpportunityPage).toHaveBeenCalledWith("f1", "o1");
    expect(within(dialog).getByRole("button", { name: "Save and close" })).toBeInTheDocument();
  });
});

describe("New quote step 1, the account (CRM-Q2.1)", () => {
  // Catches: the business name not searching the firm's accounts while typing, the accounts that could be it not offered to pick, or New account not kept as the other way on.
  it("shows the accounts that could be the business as the agent types its name, beside a New account choice", async () => {
    searchRecords.mockResolvedValue(found([account("a1", "Harborview Dental Group"), account("a2", "Harbor Freight Supply", { state: "WA", city: null })]));
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Harb");
    const options = await within(dialog).findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Harborview Dental GroupGresham, OR", "Harbor Freight SupplyWA"]);
    expect(searchRecords).toHaveBeenLastCalledWith("f1", "Harb");
    expect(within(dialog).getByRole("button", { name: "New account" })).toBeInTheDocument();
  });

  // Catches: New account not asking for the story's fields (name, state, employees; the contact's name and an email or phone), or not carrying in the name already typed.
  it("on New account asks for the account's name (as typed), state and employees, and the contact's name, email and phone", async () => {
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Acme Bakery");
    await user.click(within(dialog).getByRole("button", { name: "New account" }));
    const form = await within(dialog).findByRole("group", { name: "New account" });
    expect(within(form).getByLabelText("Account name")).toHaveValue("Acme Bakery");
    for (const label of ["State", "Employees", "Contact name", "Contact email", "Contact phone"]) expect(within(form).getByLabelText(label)).toBeInTheDocument();
    expect(within(form).getAllByText("Required").length).toBeGreaterThan(0);
  });

  // Catches: a new account not made with the existing functions in order (account with the source New quote, then its contact as the main contact, then the opportunity on them), or the flow not
  // closing on the opportunity made.
  it("on Save and close with a new account makes the account (source New quote), its contact and an opportunity, in that order, and closes on the opportunity", async () => {
    createAccount.mockResolvedValue({ id: "a9", version: 1, name: "Acme Bakery", employees: 12, state: "OR", source: "new_quote" });
    addContact.mockResolvedValue({ contact: { id: "c9", firstName: "Lucia", lastName: "Ortega", isMain: true }, previousMain: null });
    createOpportunity.mockResolvedValue({ id: "o9", version: 1, stage: "qualifying" });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Acme Bakery");
    await user.click(within(dialog).getByRole("button", { name: "New account" }));
    await user.selectOptions(within(dialog).getByLabelText("State"), "OR");
    await user.type(within(dialog).getByLabelText("Employees"), "12");
    await user.type(within(dialog).getByLabelText("Contact name"), "Lucia Ortega");
    await user.type(within(dialog).getByLabelText("Contact email"), "lucia@acme.example");
    await user.click(within(dialog).getByRole("button", { name: "Save and close" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith({ opportunityId: "o9" }));
    expect(createAccount).toHaveBeenCalledWith("f1", expect.objectContaining({ name: "Acme Bakery", state: "OR", employees: 12, ownerId: null, source: "new_quote" }));
    expect(addContact).toHaveBeenCalledWith("f1", "a9", expect.objectContaining({ firstName: "Lucia", lastName: "Ortega", email: "lucia@acme.example", phone: "", isMain: true }));
    expect(createOpportunity).toHaveBeenCalledWith("f1", "a9", expect.objectContaining({ name: "PEO search", mainContactId: "c9", employees: 12 }));
    expect(createAccount.mock.invocationCallOrder[0]).toBeLessThan(addContact.mock.invocationCallOrder[0]);
    expect(addContact.mock.invocationCallOrder[0]).toBeLessThan(createOpportunity.mock.invocationCallOrder[0]);
  });

  // Catches: a new account saved with no name, or with no contact name (both required), or the refusal not said next to the field in words.
  it("makes nothing and says what is missing when the account's name or the contact's name is empty", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("button", { name: "New account" }));
    await user.click(within(dialog).getByRole("button", { name: "Save and close" }));
    expect(await within(dialog).findByText("Enter the account's name.")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the contact's name.")).toBeInTheDocument();
    expect(createAccount).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // Catches: a contact saved with neither an email nor a phone (the story asks for one of them), or one of them being enough not accepted.
  it("asks for an email or a phone with the contact, and takes either alone", async () => {
    createAccount.mockResolvedValue({ id: "a9", version: 1, name: "Acme Bakery", employees: null, state: null, source: "new_quote" });
    addContact.mockResolvedValue({ contact: { id: "c9", firstName: null, lastName: "Lucia", isMain: true }, previousMain: null });
    createOpportunity.mockResolvedValue({ id: "o9", version: 1, stage: "qualifying" });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Acme Bakery");
    await user.click(within(dialog).getByRole("button", { name: "New account" }));
    await user.type(within(dialog).getByLabelText("Contact name"), "Lucia");
    await user.click(within(dialog).getByRole("button", { name: "Save and close" }));
    expect(await within(dialog).findByText("Give the contact an email or a phone.")).toBeInTheDocument();
    expect(createAccount).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Contact phone"), "(503) 555-0142");
    await user.click(within(dialog).getByRole("button", { name: "Save and close" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith({ opportunityId: "o9" }));
    expect(addContact).toHaveBeenCalledWith("f1", "a9", expect.objectContaining({ email: "", phone: "(503) 555-0142" }));
  });

  // Catches: a refusal of the contact (after the account was made) lost or shown as a connection failure, or Save and close again making a second account instead of going on from the first.
  it("says the database's words when the contact is refused, and a second Save and close goes on from the account already made", async () => {
    const { ContactError } = await import("@/lib/contactApi");
    createAccount.mockResolvedValue({ id: "a9", version: 1, name: "Acme Bakery", employees: null, state: null, source: "new_quote" });
    addContact.mockRejectedValueOnce(new ContactError("invalid", "Enter an email like name@example.com.")).mockResolvedValue({ contact: { id: "c9", firstName: null, lastName: "Lucia", isMain: true }, previousMain: null });
    createOpportunity.mockResolvedValue({ id: "o9", version: 1, stage: "qualifying" });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Acme Bakery");
    await user.click(within(dialog).getByRole("button", { name: "New account" }));
    await user.type(within(dialog).getByLabelText("Contact name"), "Lucia");
    await user.type(within(dialog).getByLabelText("Contact email"), "lucia@");
    await user.click(within(dialog).getByRole("button", { name: "Save and close" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter an email like name@example.com.");
    expect(onClose).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText("Contact email"));
    await user.type(within(dialog).getByLabelText("Contact email"), "lucia@acme.example");
    await user.click(within(dialog).getByRole("button", { name: "Save and close" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith({ opportunityId: "o9" }));
    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(addContact).toHaveBeenCalledTimes(2);
    expect(addContact.mock.calls[1][1]).toBe("a9");
  });

  // Catches: a New account that never asks the database whether it may be a business the firm already has (the duplicate match, CRM-S4.2, D-193), or one that blocks the save instead of advising.
  it("shows the duplicate match under New account's fields, by name and state, and leaves Save and close available", async () => {
    checkAccountDuplicates.mockResolvedValue({ matches: [{ visible: true, kind: "account", id: "a1", name: "Acme Bakery LLC", archived: false, reasons: ["name"], owner: { id: "u2", name: "Marcus Hale" } }], more: 0 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Acme Bakery");
    await user.click(within(dialog).getByRole("button", { name: "New account" }));
    await user.selectOptions(within(dialog).getByLabelText("State"), "OR");
    const warning = await within(dialog).findByRole("status", { name: "Possible duplicate" });
    expect(warning).toHaveTextContent("This may already be an account.");
    expect(within(warning).getByRole("link", { name: "Acme Bakery LLC" })).toHaveAttribute("href", "/accounts/a1");
    expect(checkAccountDuplicates).toHaveBeenLastCalledWith("f1", { name: "Acme Bakery", website: "", state: "OR" });
    expect(within(dialog).getByRole("button", { name: "Save and close" })).toBeEnabled();
  });

  // Catches: picking an existing account not offering its contacts (main one chosen) and its open opportunity to continue, offering a won or lost one as open, or leaving out the new opportunity.
  it("offers a picked account's contacts and its open opportunity, or a new opportunity", async () => {
    searchRecords.mockResolvedValue(found([account("a1", "Harborview Dental Group")]));
    listAccountTab.mockResolvedValue({ count: 3, rows: [opportunity("o1", "January 2028 PEO search", "qualifying"), opportunity("o2", "2025 search", "won"), opportunity("o3", "2024 search", "lost")] });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Harb");
    await user.click(await within(dialog).findByRole("option", { name: /Harborview Dental Group/ }));
    const contacts = await within(dialog).findByRole("radiogroup", { name: "Contact" });
    expect(within(contacts).getAllByRole("radio").map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual(["Elena Marsh, Practice Manager", "Owen Park"]);
    expect(within(contacts).getByRole("radio", { name: /Elena Marsh/ })).toBeChecked();
    const opportunities = within(dialog).getByRole("radiogroup", { name: "Opportunity" });
    expect(within(opportunities).getAllByRole("radio").map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual(["January 2028 PEO search, Qualifying", "New opportunity"]);
    expect(within(opportunities).getByRole("radio", { name: /January 2028 PEO search/ })).toBeChecked();
    expect(getNewOpportunityContext).toHaveBeenCalledWith("f1", "a1");
  });

  // Catches: the account's main contact not being the one chosen when it is not the first in the list (the contact the opportunity and the intake are about).
  it("chooses the account's main contact, wherever it sits in the list", async () => {
    searchRecords.mockResolvedValue(found([account("a1", "Harborview Dental Group")]));
    getNewOpportunityContext.mockResolvedValue({ ...context(), contacts: [{ id: "c2", name: "Owen Park", title: null, isMain: false }, { id: "c1", name: "Elena Marsh", title: null, isMain: true }] });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Harb");
    await user.click(await within(dialog).findByRole("option", { name: /Harborview Dental Group/ }));
    expect(await within(dialog).findByRole("radio", { name: "Elena Marsh" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Owen Park" })).not.toBeChecked();
  });

  // Catches: continuing an existing account's open opportunity making a second account, contact or opportunity (step 1 makes records only for what is new), or not handing the opportunity on.
  it("on Save and close with an existing account and its open opportunity, makes nothing and closes on that opportunity", async () => {
    searchRecords.mockResolvedValue(found([account("a1", "Harborview Dental Group")]));
    listAccountTab.mockResolvedValue({ count: 1, rows: [opportunity("o1", "January 2028 PEO search", "qualifying")] });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Harb");
    await user.click(await within(dialog).findByRole("option", { name: /Harborview Dental Group/ }));
    await within(dialog).findByRole("radiogroup", { name: "Contact" });
    await user.click(within(dialog).getByRole("button", { name: "Save and close" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith({ opportunityId: "o1" }));
    expect(createAccount).not.toHaveBeenCalled();
    expect(addContact).not.toHaveBeenCalled();
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  // Catches: a new opportunity on an existing account not made with the existing function and the chosen contact as its main contact, made on a new account too, or the account's employees not carried in.
  it("on Save and close with an existing account and New opportunity, makes just the opportunity, named as typed, with the chosen contact and the account's employees", async () => {
    searchRecords.mockResolvedValue(found([account("a1", "Harborview Dental Group")]));
    createOpportunity.mockResolvedValue({ id: "o9", version: 1, stage: "qualifying" });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText("Business name"), "Harb");
    await user.click(await within(dialog).findByRole("option", { name: /Harborview Dental Group/ }));
    await user.click(await within(dialog).findByRole("radio", { name: "Owen Park" }));
    expect(within(dialog).getByRole("radio", { name: "New opportunity" })).toBeChecked();
    const name = within(dialog).getByLabelText("Opportunity name");
    expect(name).toHaveValue("PEO search");
    await user.type(name, " 2028");
    await user.click(within(dialog).getByRole("button", { name: "Save and close" }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith({ opportunityId: "o9" }));
    expect(createOpportunity).toHaveBeenCalledWith("f1", "a1", expect.objectContaining({ name: "PEO search 2028", mainContactId: "c2", employees: 45, ownerId: null, renewalId: null }));
    expect(createAccount).not.toHaveBeenCalled();
    expect(addContact).not.toHaveBeenCalled();
  });
});

const certifiedIntake = (over: Record<string, unknown> = {}) => ({
  submissionId: "s1", fileId: "NV-0001", pipelineStatus: "ready_to_send", certifiedBy: "Lucia Torres", certifiedAt: "2026-11-10T15:00:00Z", version: 1, censusSize: 45,
  answered: null, prospectName: null, openItems: { count: 0, firstLabel: null, firstField: null }, ...over,
});

describe("New quote step 3, certified (CRM-Q2.4, D-1770)", () => {
  // Catches: step 3 rebuilt as a new screen, or the certified intake not opened from the opportunity at all (the founder's rule: reuse the submission page's certified view).
  it("opens the existing certified view of the opportunity's certified intake, the submission page itself", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: certifiedIntake() }));
    const { dialog } = await open({ opportunityId: "o1" });
    expect(await within(dialog).findByTestId("submission-page")).toHaveTextContent("s1|embedded");
  });
});

describe("New quote step 3 keeps Save and close (CRM-Q2.4, D-1772)", () => {
  // Catches: the certified view taking over the dialog with no way to leave it by New quote's own Save and close, which hands the opportunity back to the page beneath.
  it("shows Save and close beside the certified view, and it closes on the opportunity", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: certifiedIntake() }));
    const { user, dialog } = await open({ opportunityId: "o1" });
    await within(dialog).findByTestId("submission-page");
    await user.click(within(dialog).getByRole("button", { name: "Save and close" }));
    expect(onClose).toHaveBeenCalledWith({ opportunityId: "o1" });
  });
});

describe("New quote step 3 has a way back to the flow (CRM-Q2.4, D-1773)", () => {
  // Catches: the certified view being a dead end inside New quote: no way back to the flow's own saved account, contact and opportunity.
  it("goes back to the saved account, contact and opportunity from the certified view", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: certifiedIntake() }));
    const { user, dialog } = await open({ opportunityId: "o1" });
    await within(dialog).findByTestId("submission-page");
    await user.click(within(dialog).getByRole("button", { name: "Back to New quote" }));
    expect(within(dialog).getByText("Harborview Dental Group")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("submission-page")).not.toBeInTheDocument();
  });
});

describe("New quote step 3 can be reopened from the flow (CRM-Q2.4, D-1773)", () => {
  // Catches: going back leaving no way to the certified view again (a one-way door).
  it("reopens the certified view from the saved summary of a certified opportunity", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: certifiedIntake() }));
    const { user, dialog } = await open({ opportunityId: "o1" });
    await within(dialog).findByTestId("submission-page");
    await user.click(within(dialog).getByRole("button", { name: "Back to New quote" }));
    await user.click(within(dialog).getByRole("button", { name: "Certified answers" }));
    expect(within(dialog).getByTestId("submission-page")).toHaveTextContent("s1|embedded");
  });
});

describe("New quote step 3 before the employer certifies (D-1771)", () => {
  // Catches: the certified view opened for a draft intake (it would show a half-answered submission as if it were certified).
  it("does not open the certified view for an intake that is not certified, and keeps the saved summary with Save and close", async () => {
    getOpportunityPage.mockResolvedValue(page({ intake: certifiedIntake({ certifiedAt: null, certifiedBy: null, version: null, fileId: null, answered: 12, prospectName: "Lucia Torres" }) }));
    const { dialog } = await open({ opportunityId: "o1" });
    expect(await within(dialog).findByText("Harborview Dental Group")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("submission-page")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save and close" })).toBeInTheDocument();
  });
});
