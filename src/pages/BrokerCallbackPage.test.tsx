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

  it("takes a broker whose mailbox couldn't be connected to where they can try again", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: true, mailbox: "failed" });
    renderAt("?code=abc&next=%2Fadvisor%2Fheld");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/advisor/mailbox?connect=failed"));
  });

  it("goes on to the page the broker came from, but only inside the console", async () => {
    finishBrokerSignIn.mockResolvedValue({ ok: true, mailbox: "not_granted" });
    renderAt("?code=abc&next=%2Fadvisor%2Fheld");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/advisor/held"));
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
