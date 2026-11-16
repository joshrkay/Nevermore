import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const requestContact = vi.fn();
vi.mock("@/lib/contactRequestApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/contactRequestApi")>("@/lib/contactRequestApi");
  return { ...actual, requestContact: (...a: unknown[]) => requestContact(...a) };
});
// Cloudflare's widget is faked: it mounts, and its two buttons stand for the visitor passing the check and the widget failing.
const mounted = vi.fn();
vi.mock("@/components/TurnstileWidget", async () => {
  const { useEffect, useRef } = await import("react");
  const FakeTurnstileWidget = ({ siteKey, onToken, onError }: { siteKey: string; onToken: (t: string) => void; onError: () => void }) => {
    // The widget's number is how many have been mounted so far: a widget mounted anew (a new check) is the next number.
    const number = useRef(0);
    useEffect(() => {
      mounted(siteKey);
      number.current = mounted.mock.calls.length;
    }, [siteKey]);
    return (
      <div>
        <button type="button" onClick={() => onToken("token-" + number.current)}>pass the check</button>
        <button type="button" onClick={onError}>fail the check</button>
      </div>
    );
  };
  return { default: FakeTurnstileWidget };
});

const { default: ContactMeForm } = await import("./ContactMeForm");
const { ContactRequestError } = await import("@/lib/contactRequestApi");

// The "contact me" on a firm's public link (story CRM-L1.2b, screen 21's visitor side; slice 8.7b's captcha): a visitor who starts no intake asks the firm to get in touch.
const renderForm = () => render(<ContactMeForm address="acme-brokers" firmName="Acme Brokers" />);
const ask = () => screen.getByRole("button", { name: "Ask Acme Brokers to contact me" }) as HTMLButtonElement;

beforeEach(() => {
  requestContact.mockReset();
  mounted.mockReset();
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key-123");
});

afterEach(() => {
  vi.unstubAllEnvs();
  document.head.querySelectorAll("script").forEach((s) => s.remove());
});

describe("the contact me form", () => {
  // Break caught: the form sends nothing, sends the wrong address, forgets the Turnstile token, or leaves the visitor with no word that the firm has their details.
  it("sends what the visitor typed with the firm's address and the token, then says the firm will be in touch", async () => {
    requestContact.mockResolvedValue("taken");
    renderForm();
    await userEvent.type(screen.getByLabelText(/^Your name/), "Pat Visitor");
    await userEvent.type(screen.getByLabelText(/^Email/), "pat@visitor.test");
    await userEvent.type(screen.getByLabelText(/^Phone/), "(503) 555-0142");
    await userEvent.type(screen.getByLabelText(/^Business/), "Visitor Co");
    await userEvent.type(screen.getByLabelText(/^Message/), "Please call me.");
    await userEvent.click(screen.getByRole("button", { name: "pass the check" }));
    await userEvent.click(ask());
    expect(requestContact).toHaveBeenCalledWith({
      address: "acme-brokers", name: "Pat Visitor", email: "pat@visitor.test", phone: "(503) 555-0142", business: "Visitor Co", message: "Please call me.", token: "token-1",
    });
    expect(await screen.findByText("Thanks. Acme Brokers has your details and will be in touch.")).toBeTruthy();
  });

  // Break caught: a refused field is lost (the visitor retypes everything) or shown as a blank page or a database error.
  it("says what is wrong in the database's words and keeps what the visitor typed", async () => {
    requestContact.mockRejectedValue(new ContactRequestError("invalid", "Enter an email address or a phone number so the firm can reach you."));
    renderForm();
    await userEvent.type(screen.getByLabelText(/^Your name/), "Pat Visitor");
    await userEvent.click(screen.getByRole("button", { name: "pass the check" }));
    await userEvent.click(ask());
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
    await userEvent.click(screen.getByRole("button", { name: "pass the check" }));
    await userEvent.click(ask());
    expect((await screen.findByRole("alert")).textContent).toBe("Lots of requests are coming in right now. Try again in a little while.");
    expect(screen.queryByText(/has your details/)).toBeNull();
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe("pat@visitor.test");
  });

  // Break caught: a second press while the first is on its way sends the request twice.
  it("sends once however many times the button is pressed while it is on its way", async () => {
    requestContact.mockReturnValue(new Promise(() => {}));
    renderForm();
    await userEvent.type(screen.getByLabelText(/^Your name/), "Pat Visitor");
    await userEvent.click(screen.getByRole("button", { name: "pass the check" }));
    await userEvent.click(ask());
    const sending = screen.getByRole("button", { name: "Sending…" }) as HTMLButtonElement;
    expect(sending.disabled).toBe(true);
    await userEvent.click(sending);
    expect(requestContact).toHaveBeenCalledTimes(1);
  });
});

describe("the contact me form's captcha", () => {
  // Break caught: the form can be sent before the visitor has passed the check, so the function refuses it after they typed everything.
  it("shows Turnstile's widget with the site key, and cannot be sent until the visitor passes it", async () => {
    renderForm();
    expect(mounted).toHaveBeenCalledWith("site-key-123");
    expect(ask().disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "pass the check" }));
    expect(ask().disabled).toBe(false);
  });

  // Break caught: with no site key the form opens anyway (open without the check), or the widget's script is loaded for a visitor who can do nothing with it.
  it("is not offered, in plain words, with no site key: no fields, no widget", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    renderForm();
    expect(screen.getByRole("status").textContent).toBe("Asking to be contacted isn't available right now");
    expect(screen.queryByLabelText(/^Your name/)).toBeNull();
    expect(screen.queryByRole("button", { name: /contact me/ })).toBeNull();
    expect(mounted).not.toHaveBeenCalled();
  });

  // Break caught: a token is single-use, so after a try that failed the widget keeps a spent token and the visitor's next press is refused again.
  it("asks for a fresh check after a request that was not taken, and keeps what was typed", async () => {
    requestContact.mockRejectedValueOnce(new ContactRequestError("failed", "The check didn't pass. Try again."));
    requestContact.mockResolvedValueOnce("taken");
    renderForm();
    await userEvent.type(screen.getByLabelText(/^Your name/), "Pat Visitor");
    await userEvent.click(screen.getByRole("button", { name: "pass the check" }));
    await userEvent.click(ask());
    expect((await screen.findByRole("alert")).textContent).toBe("The check didn't pass. Try again.");
    expect(ask().disabled).toBe(true);
    expect((screen.getByLabelText(/^Your name/) as HTMLInputElement).value).toBe("Pat Visitor");
    await userEvent.click(screen.getByRole("button", { name: "pass the check" }));
    await userEvent.click(ask());
    expect(requestContact).toHaveBeenLastCalledWith(expect.objectContaining({ token: "token-2" }));
  });

  // Break caught: the widget cannot load (blocked script, offline) and the visitor sees a form that never enables, with no word why.
  it("says so when the check cannot load, and cannot be sent", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "fail the check" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The check couldn't load. Reload the page and try again.");
    expect(ask().disabled).toBe(true);
  });
});
