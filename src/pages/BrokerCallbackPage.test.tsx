import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const finishBrokerSignIn = vi.fn();
vi.mock("@/lib/brokerAuth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/brokerAuth")>()), finishBrokerSignIn: (...a: unknown[]) => finishBrokerSignIn(...a) }));

const { default: BrokerCallbackPage } = await import("./BrokerCallbackPage");

const assign = vi.fn();
const renderAt = (search: string) =>
  render(<MemoryRouter initialEntries={[`/broker/callback${search}`]}><BrokerCallbackPage /></MemoryRouter>);

describe("BrokerCallbackPage", () => {
  beforeEach(() => {
    finishBrokerSignIn.mockReset();
    assign.mockReset();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
  });

  it("redeems the code once and loads the console afresh", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: true, mailbox: "connected" });
    renderAt("?code=abc");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/advisor"));
    expect(finishBrokerSignIn).toHaveBeenCalledTimes(1);
    expect(finishBrokerSignIn).toHaveBeenCalledWith("abc");
  });

  // Catches: a failed mailbox connection replacing the page the sign-in was for (an export's step-up) with the mailbox page, losing its filters and its firm.
  it("keeps the page the broker came from when their mailbox couldn't be connected, and carries the failure to it", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: true, mailbox: "failed" });
    renderAt("?code=abc&next=%2Fadvisor%2Fheld");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/advisor/held?connect=failed"));
  });

  it("adds the failure to the page's own filters, keeping them", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: true, mailbox: "failed" });
    renderAt(`?code=abc&next=${encodeURIComponent("/advisor/activity?firm=f1&kind=send_recorded")}`);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/advisor/activity?firm=f1&kind=send_recorded&connect=failed"));
  });

  // Catches: a broker who signed in for no page in particular being left on the queue with no way to try the mailbox again.
  it("takes a broker who came for no page in particular to the mailbox page, where they can try again", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: true, mailbox: "failed" });
    renderAt("?code=abc");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/advisor/mailbox?connect=failed"));
  });

  it("goes on to the page the broker came from, but only inside the console", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: true, mailbox: "not_granted" });
    renderAt("?code=abc&next=%2Fadvisor%2Fheld");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/advisor/held"));
  });

  it("goes back to the page's filters and firm, as the sign-in carried them", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: true, mailbox: "connected" });
    renderAt(`?code=abc&next=${encodeURIComponent("/advisor/activity?firm=f1&kind=send_recorded")}`);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/advisor/activity?firm=f1&kind=send_recorded"));
  });

  it("ignores a next that leaves the console", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: true, mailbox: "connected" });
    renderAt("?code=abc&next=https%3A%2F%2Fevil.example");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/advisor"));
  });

  it("tells a refusal at the provider in its own words, never the link's", async () => {
    renderAt("?error=access_denied&error_description=Visit%20evil.example%20now");
    expect(await screen.findByText("We couldn't sign you in")).toBeInTheDocument();
    expect(screen.queryByText(/evil\.example/)).not.toBeInTheDocument();
    expect(finishBrokerSignIn).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/broker/sign-in");
  });

  it("fails when there is no code, or the code can't be redeemed", async () => {
    renderAt("");
    expect(await screen.findByText("We couldn't sign you in")).toBeInTheDocument();
    expect(finishBrokerSignIn).not.toHaveBeenCalled();
  });

  it("fails when redeeming throws or gives no session", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: false });
    renderAt("?code=used");
    expect(await screen.findByText("We couldn't sign you in")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});
