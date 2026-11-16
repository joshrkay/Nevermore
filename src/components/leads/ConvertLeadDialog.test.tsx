import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The Convert dialog (story CRM-L2.2, screen 22) through a faked client: what the agent sees and chooses. The database's rules are tested in
// supabase/tests/convert_lead.sql and the client's shapes in src/lib/leadConvertApi.test.ts.

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const api = { getConvertMatches: vi.fn(), convertLead: vi.fn() };
vi.mock("@/lib/leadConvertApi", async () => ({ ...(await vi.importActual<object>("@/lib/leadConvertApi")), ...api }));

const { ConvertLeadDialog } = await import("./ConvertLeadDialog");

const lead = {
  id: "l1", name: "Lucia Reyes", title: "Owner" as string | null, business: "Reyes Bakery" as string | null, email: "lucia@reyes.example" as string | null,
  phone: "(503) 555-0142" as string | null,
};
const onClose = vi.fn();
const onConverted = vi.fn();
const renderDialog = (l: Partial<typeof lead> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <ConvertLeadDialog firmId="f1" lead={{ ...lead, ...l }} onClose={onClose} onConverted={onConverted} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  for (const fn of [...Object.values(api), onClose, onConverted]) fn.mockReset();
  api.getConvertMatches.mockResolvedValue([]);
});

describe("ConvertLeadDialog: the account", () => {
  // Catches: a second account made for a business already held, because the possible matches were hidden or came after "Create account".
  it("lists the possible matches first, then Create account for the business", async () => {
    api.getConvertMatches.mockResolvedValue([{ id: "a9", name: "Reyes Bakery LLC", city: "Portland", state: "OR", reasons: ["name"] }]);
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Convert Lucia Reyes" });
    const options = await within(dialog).findAllByRole("radio");
    expect(options.map((o) => o.closest("label")?.textContent)).toEqual(["Use Reyes Bakery LLC (Portland, OR)", "Create account Reyes Bakery"]);
  });

  // Catches: a failed look for matches that reads as "no matches" (a second account for a known business), or that blocks converting altogether.
  it("says it could not look for matching accounts, and still lets the agent create one", async () => {
    const user = userEvent.setup();
    api.getConvertMatches.mockRejectedValue(new Error("down"));
    api.convertLead.mockResolvedValue({ account: { id: "a1", name: "Reyes Bakery", created: true }, contact: null, opportunity: null });
    renderDialog();
    expect(await screen.findByText("Couldn't look for accounts this might be. You can still make a new one.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Create account Reyes Bakery/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(api.convertLead).toHaveBeenCalled());
  });

  // Catches: converting into an existing account by default, when the agent has not chosen one (D-1683: the default is making a new one).
  it("makes a new account unless the agent chooses a match", async () => {
    api.getConvertMatches.mockResolvedValue([{ id: "a9", name: "Reyes Bakery LLC", city: "Portland", state: "OR", reasons: ["name"] }]);
    renderDialog();
    expect(await screen.findByRole("radio", { name: /^Create account Reyes Bakery/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Use Reyes Bakery LLC/ })).not.toBeChecked();
  });

  // Catches: a match that cannot be chosen, so a known business gets a second account anyway.
  it("lets the agent choose a match instead, and back to creating one", async () => {
    const user = userEvent.setup();
    api.getConvertMatches.mockResolvedValue([{ id: "a9", name: "Reyes Bakery LLC", city: "Portland", state: "OR", reasons: ["name"] }]);
    renderDialog();
    await user.click(await screen.findByRole("radio", { name: /^Use Reyes Bakery LLC/ }));
    expect(screen.getByRole("radio", { name: /^Use Reyes Bakery LLC/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Create account/ })).not.toBeChecked();
    await user.click(screen.getByRole("radio", { name: /^Create account/ }));
    expect(screen.getByRole("radio", { name: /^Create account/ })).toBeChecked();
  });
});

describe("ConvertLeadDialog: converting", () => {
  // Catches: a Convert that sends something other than what the dialog offered (the lead's person, a new account for the business, nothing for the opportunity yet).
  it("converts with the defaults: a new account, the lead's person, no target start", async () => {
    const user = userEvent.setup();
    api.convertLead.mockResolvedValue({ account: { id: "a1", name: "Reyes Bakery", created: true }, contact: null, opportunity: null });
    renderDialog({ name: "Lucia Maria Reyes" });
    await user.click(await screen.findByRole("button", { name: "Convert" }));
    expect(api.convertLead).toHaveBeenCalledWith("f1", "l1", expect.objectContaining({
      accountId: null, makeContact: true, firstName: "Lucia Maria", lastName: "Reyes", email: "lucia@reyes.example", phone: "(503) 555-0142",
    }));
  });
});

describe("ConvertLeadDialog: the opportunity", () => {
  // Catches: an opportunity that is not offered by default, or named differently from the lead page's "Converting makes" (D-810, D-1653).
  it("is ticked, named for the account, with no target start", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Convert Lucia Reyes" });
    expect(within(dialog).getByRole("checkbox", { name: "Make an opportunity" })).toBeChecked();
    expect(within(dialog).getByLabelText("Opportunity name")).toHaveValue("Reyes Bakery – PEO search");
    expect(within(dialog).getByLabelText("Target start")).toHaveValue("");
  });

  // Catches: an opportunity named for a business the agent did not choose, when converting into an existing account (D-1685), or the existing account not sent.
  it("is named for the account chosen, and that account is sent", async () => {
    const user = userEvent.setup();
    api.getConvertMatches.mockResolvedValue([{ id: "a9", name: "Reyes Bakery LLC", city: "Portland", state: "OR", reasons: ["name"] }]);
    api.convertLead.mockResolvedValue({ account: { id: "a9", name: "Reyes Bakery LLC", created: false }, contact: null, opportunity: null });
    renderDialog();
    await user.click(await screen.findByRole("radio", { name: /^Use Reyes Bakery LLC/ }));
    expect(screen.getByLabelText("Opportunity name")).toHaveValue("Reyes Bakery LLC – PEO search");
    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(api.convertLead).toHaveBeenCalledWith("f1", "l1", expect.objectContaining({ accountId: "a9", opportunityName: "Reyes Bakery LLC – PEO search" }));
  });
});

describe("ConvertLeadDialog: the opportunity, typed", () => {
  // Catches: a typed name or target start thrown away for the default (the database takes exactly what is sent).
  it("sends the name and target start the agent typed", async () => {
    const user = userEvent.setup();
    api.convertLead.mockResolvedValue({ account: { id: "a1", name: "Reyes Bakery", created: true }, contact: null, opportunity: null });
    renderDialog();
    const name = await screen.findByLabelText("Opportunity name");
    await user.clear(name);
    await user.type(name, "Reyes January start");
    await user.type(screen.getByLabelText("Target start"), "2027-01-15");
    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(api.convertLead).toHaveBeenCalledWith("f1", "l1", expect.objectContaining({ opportunityName: "Reyes January start", targetStart: "2027-01-15" }));
  });
});

describe("ConvertLeadDialog: no opportunity", () => {
  // Catches: an opportunity made though the agent unticked it, or its fields left on screen with nothing to do.
  it("makes none when unticked, and then asks for no name or target start", async () => {
    const user = userEvent.setup();
    api.convertLead.mockResolvedValue({ account: { id: "a1", name: "Reyes Bakery", created: true }, contact: null, opportunity: null });
    renderDialog();
    await user.click(await screen.findByRole("checkbox", { name: "Make an opportunity" }));
    expect(screen.queryByLabelText("Opportunity name")).toBeNull();
    expect(screen.queryByLabelText("Target start")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(api.convertLead).toHaveBeenCalledWith("f1", "l1", expect.objectContaining({ makeOpportunity: false, opportunityName: "", targetStart: "" }));
  });
});

describe("ConvertLeadDialog: no contact", () => {
  // Catches: a contact made though the agent unticked it (and then blocked by its own rules), or its fields left on screen.
  it("makes none when unticked, and then asks for no name, email or phone", async () => {
    const user = userEvent.setup();
    api.convertLead.mockResolvedValue({ account: { id: "a1", name: "Reyes Bakery", created: true }, contact: null, opportunity: null });
    renderDialog();
    await user.click(await screen.findByRole("checkbox", { name: "Make a contact" }));
    expect(screen.queryByLabelText("First name")).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(api.convertLead).toHaveBeenCalledWith("f1", "l1", expect.objectContaining({ makeContact: false }));
  });

  // Catches: a one-word name put in the first name, leaving the last name the database requires empty (it splits by the last word).
  it("takes a one-word name as the last name alone", async () => {
    renderDialog({ name: "Lucia", business: "Reyes Bakery" });
    await screen.findByRole("dialog", { name: "Convert Lucia" });
    expect(screen.getByLabelText("First name")).toHaveValue("");
    expect(screen.getByLabelText("Last name")).toHaveValue("Lucia");
  });

  // Catches: a business's own name split into a person's first and last name when the agent ticks a contact for it (D-1684).
  it("leaves the names blank when a contact is ticked for a business with no person", async () => {
    const user = userEvent.setup();
    renderDialog({ name: "Reyes Bakery", business: "Reyes Bakery" });
    await user.click(await screen.findByRole("checkbox", { name: "Make a contact" }));
    expect(screen.getByLabelText("First name")).toHaveValue("");
    expect(screen.getByLabelText("Last name")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("lucia@reyes.example");
  });

  // Catches: what the agent filled in on the form ignored for the lead's own (a contact made for someone else, with no way to reach them).
  it("sends the name, email and phone the agent typed", async () => {
    const user = userEvent.setup();
    api.convertLead.mockResolvedValue({ account: { id: "a1", name: "Reyes Bakery", created: true }, contact: null, opportunity: null });
    renderDialog({ name: "Reyes Bakery", business: "Reyes Bakery", email: null, phone: null });
    await user.click(await screen.findByRole("checkbox", { name: "Make a contact" }));
    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "Lopez");
    await user.type(screen.getByLabelText("Email"), "ana@reyes.example");
    await user.type(screen.getByLabelText("Phone"), "503-555-0100");
    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(api.convertLead).toHaveBeenCalledWith("f1", "l1", expect.objectContaining({
      makeContact: true, firstName: "Ana", lastName: "Lopez", email: "ana@reyes.example", phone: "503-555-0100",
    }));
  });

  // Catches: telling the agent "no person is named" about a lead that names one, because they unticked the contact themselves.
  it("does not say no person is named when the agent unticks a person's contact", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole("checkbox", { name: "Make a contact" }));
    expect(screen.queryByText("No person is named, so no contact is made.")).toBeNull();
  });
});

describe("ConvertLeadDialog: a contact needs a way to reach them", () => {
  // Catches: a contact with no email and no phone sent to a database that refuses it, instead of asking on the form in its words (D-810).
  it("asks for an email or a phone, and sends nothing, when the contact has neither", async () => {
    const user = userEvent.setup();
    renderDialog({ email: null, phone: null });
    await user.click(await screen.findByRole("button", { name: "Convert" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter an email or a phone number.");
    expect(api.convertLead).not.toHaveBeenCalled();
  });

  // Catches: a contact with no name sent to the database (a business's own name is never split into a person's, so a ticked contact needs one typed).
  it("asks for the contact's last name, and sends nothing, when it is blank", async () => {
    const user = userEvent.setup();
    renderDialog({ name: "Reyes Bakery", business: "Reyes Bakery" });
    await user.click(await screen.findByRole("checkbox", { name: "Make a contact" }));
    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the contact's last name.");
    expect(api.convertLead).not.toHaveBeenCalled();
  });

  // Catches: the rules applied to a contact the agent unticked, blocking a conversion that makes none.
  it("asks for nothing about a contact the agent unticked", async () => {
    const user = userEvent.setup();
    api.convertLead.mockResolvedValue({ account: { id: "a1", name: "Reyes Bakery", created: true }, contact: null, opportunity: null });
    renderDialog({ email: null, phone: null });
    await user.click(await screen.findByRole("checkbox", { name: "Make a contact" }));
    await user.click(screen.getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(api.convertLead).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("ConvertLeadDialog: refused", () => {
  // Catches: a refusal that closes the dialog or loses what was typed (the agent would start again), or is said in words other than the database's.
  it("shows the database's own words and stays open with what was typed", async () => {
    const user = userEvent.setup();
    const { ContactError } = await import("@/lib/contactApi");
    api.convertLead.mockRejectedValue(new ContactError("invalid", "This opportunity's name is too long.", "22023"));
    renderDialog();
    const name = await screen.findByLabelText("Opportunity name");
    await user.type(name, " for January");
    await user.click(screen.getByRole("button", { name: "Convert" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This opportunity's name is too long.");
    expect(screen.getByLabelText("Opportunity name")).toHaveValue("Reyes Bakery – PEO search for January");
    expect(onConverted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ConvertLeadDialog: failed", () => {
  // Catches: a network or programming error's own text shown to the agent (and no way to tell the conversion did not happen).
  it("says plainly that it could not convert, and stays open, when something unexpected fails", async () => {
    const user = userEvent.setup();
    api.convertLead.mockRejectedValue(new Error("fetch failed: ECONNRESET 10.0.0.4:5432"));
    renderDialog();
    await user.click(await screen.findByRole("button", { name: "Convert" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't convert the lead. Check your connection and try again.");
    expect(onConverted).not.toHaveBeenCalled();
  });
});

describe("ConvertLeadDialog: no quote yet", () => {
  // Catches: a "Convert and start a quote" button that does nothing (it waits for New quote, slice 5.4; D-402, D-810: no dead buttons).
  it("offers no Convert and start a quote", async () => {
    renderDialog();
    await screen.findByRole("dialog", { name: "Convert Lucia Reyes" });
    expect(screen.queryByRole("button", { name: /quote/i })).toBeNull();
  });
});

describe("ConvertLeadDialog: cancelling", () => {
  // Catches: a dialog with no way out but converting.
  it("closes with Cancel, converting nothing", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(api.convertLead).not.toHaveBeenCalled();
  });
});

describe("ConvertLeadDialog: converted", () => {
  // Catches: a conversion that worked and the page never hearing of it (the lead would stay on screen as a working lead).
  it("tells the page what was made", async () => {
    const user = userEvent.setup();
    const made = { account: { id: "a1", name: "Reyes Bakery", created: true }, contact: { id: "c1", name: "Lucia Reyes" }, opportunity: { id: "o1", name: "Reyes Bakery – PEO search" } };
    api.convertLead.mockResolvedValue(made);
    renderDialog();
    await user.click(await screen.findByRole("button", { name: "Convert" }));
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(made));
  });
});

describe("ConvertLeadDialog: the contact", () => {
  // Catches: asking the agent to retype the person the lead already is, or a name put whole into one field (the database splits it by the last word).
  it("is the lead's person, ticked, split into first and last name, with the lead's email and phone", async () => {
    renderDialog({ name: "Lucia Maria Reyes" });
    const dialog = await screen.findByRole("dialog", { name: "Convert Lucia Maria Reyes" });
    expect(within(dialog).getByRole("checkbox", { name: "Make a contact" })).toBeChecked();
    expect(within(dialog).getByLabelText("First name")).toHaveValue("Lucia Maria");
    expect(within(dialog).getByLabelText("Last name")).toHaveValue("Reyes");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("lucia@reyes.example");
    expect(within(dialog).getByLabelText("Phone")).toHaveValue("(503) 555-0142");
  });

  // Catches: a contact made out of a business's own name (no person is named), or a quiet absence the agent cannot account for.
  it("is unticked for a business with no person, and says no contact is made", async () => {
    renderDialog({ name: "Reyes Bakery", business: "Reyes Bakery" });
    const dialog = await screen.findByRole("dialog", { name: "Convert Reyes Bakery" });
    expect(within(dialog).getByRole("checkbox", { name: "Make a contact" })).not.toBeChecked();
    expect(within(dialog).getByText("No person is named, so no contact is made.")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("First name")).toBeNull();
  });
});
