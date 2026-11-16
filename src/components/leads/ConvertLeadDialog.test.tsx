import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadFields } from "@/lib/leadPageApi";

// The Convert dialog (story CRM-L2.2, slice 8.6, screen 22) through a faked client: what a person sees and chooses. The database's own rules (who may convert, which
// accounts may be used, a contact's name and way to reach them, all or none) are tested in supabase/tests/convert_lead.sql; here the client answers and the dialog
// draws it and sends what was chosen.

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const client = { getConvertMatches: vi.fn(), convertLead: vi.fn() };
vi.mock("@/lib/leadConvertApi", async () => ({ ...(await vi.importActual<object>("@/lib/leadConvertApi")), ...client }));

const { ConvertLeadDialog } = await import("./ConvertLeadDialog");
const { ContactError } = await import("@/lib/contactApi");

const lead: Pick<LeadFields, "id" | "name" | "business" | "title" | "email" | "phone"> = {
  id: "l1", name: "Lucia Reyes", business: "Reyes Bakery", title: "Owner", email: "lucia@reyes.example", phone: "(503) 555-0142",
};
const made = { account: { id: "a1", name: "Reyes Bakery", created: true }, contact: { id: "c1", name: "Lucia Reyes" }, opportunity: { id: "o1", name: "Reyes Bakery – PEO search" } };

const onClose = vi.fn();
const onConverted = vi.fn();

const open = async (l = lead) => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ConvertLeadDialog firmId="f1" lead={l} onClose={onClose} onConverted={onConverted} />
    </QueryClientProvider>,
  );
  const dialog = await screen.findByRole("dialog", { name: /^Convert/ });
  return { user, dialog };
};

beforeEach(() => {
  for (const m of [...Object.values(client), onClose, onConverted]) m.mockReset();
  client.getConvertMatches.mockResolvedValue([]);
  client.convertLead.mockResolvedValue(made);
});

describe("the Convert dialog (screen 22)", () => {
  // Catches: a dialog that asks the agent to retype what the lead already says, a default that differs from what the lead's page says converting makes (D-1653),
  // or a conversion that sends something other than what is on the screen.
  it("offers an account for the business, the lead's person as the contact, and an opportunity named for the account, and converts with exactly those", async () => {
    const { user, dialog } = await open();
    expect(within(dialog).getByRole("radio", { name: /Create account/ })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /Create account/ })).toHaveAccessibleName(/Reyes Bakery/);
    expect(within(dialog).getByRole("checkbox", { name: "Make a contact" })).toBeChecked();
    expect(within(dialog).getByLabelText("First name")).toHaveValue("Lucia");
    expect(within(dialog).getByLabelText("Last name")).toHaveValue("Reyes");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("lucia@reyes.example");
    expect(within(dialog).getByLabelText("Phone")).toHaveValue("(503) 555-0142");
    expect(within(dialog).getByRole("checkbox", { name: "Make an opportunity" })).toBeChecked();
    expect(within(dialog).getByLabelText("Opportunity name")).toHaveValue("Reyes Bakery – PEO search");
    expect(within(dialog).getByLabelText("Target start")).toHaveValue("");
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(client.convertLead).toHaveBeenCalledTimes(1));
    expect(client.convertLead).toHaveBeenCalledWith("f1", "l1", {
      accountId: null, makeContact: true, firstName: "Lucia", lastName: "Reyes", email: "lucia@reyes.example", phone: "(503) 555-0142",
      makeOpportunity: true, opportunityName: "Reyes Bakery – PEO search", targetStart: "",
    });
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(made));
  });

  // Catches: a possible match hidden or listed after "create", so an agent makes a second account for a business the firm has (D-810: matches come first), a chosen
  // account that is not what is sent, and an opportunity still named for the lead's business when it goes on another account.
  it("lists the possible matches before making a new account, and using one sends it and names the opportunity for it", async () => {
    client.getConvertMatches.mockResolvedValue([{ id: "a9", name: "Reyes Bakery Inc", city: "Portland", state: "OR", reasons: ["name"] }]);
    const { user, dialog } = await open();
    const radios = await within(dialog).findAllByRole("radio");
    expect(radios.map((r) => (r.closest("label") as HTMLElement).textContent)).toEqual(["Use Reyes Bakery Inc (Portland, OR)", "Create account Reyes Bakery"]);
    await user.click(radios[0]);
    expect(within(dialog).getByLabelText("Opportunity name")).toHaveValue("Reyes Bakery Inc – PEO search");
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(client.convertLead).toHaveBeenCalledTimes(1));
    expect(client.convertLead.mock.calls[0][2]).toMatchObject({ accountId: "a9", opportunityName: "Reyes Bakery Inc – PEO search" });
  });

  // Catches: a business with no person given a contact named after the business (D-1653), or "no contact" not said, so the agent thinks it was forgotten.
  it("says no contact is made for a business with no person, and converts without one", async () => {
    const { user, dialog } = await open({ ...lead, name: "reyes bakery", title: null, email: null, phone: null });
    expect(within(dialog).getByRole("checkbox", { name: "Make a contact" })).not.toBeChecked();
    expect(within(dialog).getByText("No person is named, so no contact is made.")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Last name")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(client.convertLead).toHaveBeenCalledTimes(1));
    expect(client.convertLead.mock.calls[0][2]).toMatchObject({ makeContact: false });
  });

  // Catches: an unticked contact or opportunity still sent, or their fields still asked for.
  it("makes no contact and no opportunity when they are unticked", async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole("checkbox", { name: "Make a contact" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Make an opportunity" }));
    expect(within(dialog).queryByLabelText("Last name")).toBeNull();
    expect(within(dialog).queryByLabelText("Opportunity name")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(client.convertLead).toHaveBeenCalledTimes(1));
    expect(client.convertLead.mock.calls[0][2]).toMatchObject({ makeContact: false, makeOpportunity: false });
  });

  // Catches: a person with no way to reach them sent to the database (a round trip for a refusal the form can say), the words differing from the database's,
  // or the conversion going ahead anyway.
  it("asks for an email or a phone, in the database's words, before sending a contact nobody can reach", async () => {
    const { user, dialog } = await open({ ...lead, email: null, phone: null });
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter an email or a phone number.");
    expect(client.convertLead).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Phone"), "(503) 555-0100");
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(client.convertLead).toHaveBeenCalledTimes(1));
    expect(client.convertLead.mock.calls[0][2]).toMatchObject({ phone: "(503) 555-0100" });
  });

  // Catches (from mutation): a ticked contact with no last name sent to the database, or its words differing from the database's.
  it("asks for the contact's last name before sending", async () => {
    const { user, dialog } = await open();
    await user.clear(within(dialog).getByLabelText("Last name"));
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter the contact's last name.");
    expect(client.convertLead).not.toHaveBeenCalled();
  });

  // Catches: the lead's whole name in the first-name box, or a one-word name split into a first name (the database needs a last one).
  it("splits the person's name as the database does: the last word is the last name", async () => {
    const { dialog } = await open({ ...lead, name: "Jo Q Doe" });
    expect(within(dialog).getByLabelText("First name")).toHaveValue("Jo Q");
    expect(within(dialog).getByLabelText("Last name")).toHaveValue("Doe");
  });

  // Catches: a refusal swallowed into "couldn't convert" (the agent retries something that cannot work), the dialog closing on a refusal and losing what was typed,
  // or a success reported when the database refused.
  it("shows the database's own words when it refuses, and stays open with what was typed", async () => {
    client.convertLead.mockRejectedValue(new ContactError("archived", "This lead is Not a fit. Reopen it before converting it.", "55000"));
    const { user, dialog } = await open();
    await user.clear(within(dialog).getByLabelText("Opportunity name"));
    await user.type(within(dialog).getByLabelText("Opportunity name"), "Reyes 2027");
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This lead is Not a fit. Reopen it before converting it.");
    expect(onConverted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(within(dialog).getByLabelText("Opportunity name")).toHaveValue("Reyes 2027");
    expect(within(dialog).getByRole("button", { name: "Convert" })).toBeEnabled();
  });

  // Catches: a failed look for matches that blocks converting at all, or that says nothing, so the agent makes a duplicate without knowing it never looked.
  it("says it could not look for matching accounts, and still lets the agent convert", async () => {
    client.getConvertMatches.mockRejectedValue(new ContactError("failed", "Couldn't look for matching accounts. You can still convert the lead."));
    const { user, dialog } = await open();
    expect(await within(dialog).findByText(/Couldn't look for accounts this might be/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(client.convertLead).toHaveBeenCalledTimes(1));
  });
});
