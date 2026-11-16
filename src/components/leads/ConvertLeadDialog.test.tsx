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
