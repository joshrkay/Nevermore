import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const requestContact = vi.fn();
vi.mock("@/lib/contactRequestApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/contactRequestApi")>("@/lib/contactRequestApi");
  return { ...actual, requestContact: (...a: unknown[]) => requestContact(...a) };
});

const { default: ContactMeForm } = await import("./ContactMeForm");
const { ContactRequestError } = await import("@/lib/contactRequestApi");

// The "contact me" on a firm's public link (story CRM-L1.2b, screen 21's visitor side): a visitor who starts no intake asks the firm to get in touch.
const renderForm = () => render(<ContactMeForm address="acme-brokers" firmName="Acme Brokers" />);

beforeEach(() => {
  requestContact.mockReset();
});

describe("the contact me form", () => {
  // Break caught: the form sends nothing, sends the wrong address, or leaves the visitor with no word that the firm has their details.
  it("sends what the visitor typed with the firm's address, then says the firm will be in touch", async () => {
    requestContact.mockResolvedValue("taken");
    renderForm();
    await userEvent.type(screen.getByLabelText(/^Your name/), "Pat Visitor");
    await userEvent.type(screen.getByLabelText(/^Email/), "pat@visitor.test");
    await userEvent.type(screen.getByLabelText(/^Phone/), "(503) 555-0142");
    await userEvent.type(screen.getByLabelText(/^Business/), "Visitor Co");
    await userEvent.type(screen.getByLabelText(/^Message/), "Please call me.");
    await userEvent.click(screen.getByRole("button", { name: "Ask Acme Brokers to contact me" }));
    expect(requestContact).toHaveBeenCalledWith({
      address: "acme-brokers", name: "Pat Visitor", email: "pat@visitor.test", phone: "(503) 555-0142", business: "Visitor Co", message: "Please call me.",
    });
    expect(await screen.findByText("Thanks. Acme Brokers has your details and will be in touch.")).toBeTruthy();
  });

  // Break caught: a refused field is lost (the visitor retypes everything) or shown as a blank page or a database error.
  it("says what is wrong in the database's words and keeps what the visitor typed", async () => {
    requestContact.mockRejectedValue(new ContactRequestError("invalid", "Enter an email address or a phone number so the firm can reach you."));
    renderForm();
    await userEvent.type(screen.getByLabelText(/^Your name/), "Pat Visitor");
    await userEvent.click(screen.getByRole("button", { name: "Ask Acme Brokers to contact me" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Enter an email address or a phone number so the firm can reach you.");
    expect((screen.getByLabelText(/^Your name/) as HTMLInputElement).value).toBe("Pat Visitor");
    expect(screen.queryByText(/has your details/)).toBeNull();
  });

  // Break caught: a link that has had its share for the hour tells the visitor "Thanks, we'll be in touch" for a request nobody will ever see.
  it("tells the visitor to try again later when the link is busy, and does not say the firm has their details", async () => {
    requestContact.mockResolvedValue("busy");
    renderForm();
    await userEvent.type(screen.getByLabelText(/^Your name/), "Pat Visitor");
    await userEvent.type(screen.getByLabelText(/^Email/), "pat@visitor.test");
    await userEvent.click(screen.getByRole("button", { name: "Ask Acme Brokers to contact me" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Lots of requests are coming in right now. Try again in a little while.");
    expect(screen.queryByText(/has your details/)).toBeNull();
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe("pat@visitor.test");
  });

  // Break caught: a second press while the first is on its way sends the request twice.
  it("sends once however many times the button is pressed while it is on its way", async () => {
    requestContact.mockReturnValue(new Promise(() => {}));
    renderForm();
    await userEvent.type(screen.getByLabelText(/^Your name/), "Pat Visitor");
    await userEvent.click(screen.getByRole("button", { name: "Ask Acme Brokers to contact me" }));
    const sending = screen.getByRole("button", { name: "Sending…" }) as HTMLButtonElement;
    expect(sending.disabled).toBe(true);
    await userEvent.click(sending);
    expect(requestContact).toHaveBeenCalledTimes(1);
  });
});
