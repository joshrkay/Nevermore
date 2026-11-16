import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { FirmAddress } from "@/hooks/useFirmAddress";

// "Get a quote" on a firm's public page (P-2.1, D-1713), offered by the page of slice 8.7 and shown only where the firm's link takes intakes.
let firmAddress: FirmAddress = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
const takes = vi.fn();
vi.mock("@/lib/firmApi", () => ({ fetchFirmTakesIntakes: (address: string) => takes(address) }));

const { default: GetAQuote } = await import("./GetAQuote");

const renderIt = () => render(<MemoryRouter><GetAQuote /></MemoryRouter>);

describe("GetAQuote", () => {
  beforeEach(() => {
    firmAddress = { status: "known", address: "alpha-advisory", name: "Alpha Advisory" };
    takes.mockReset();
    takes.mockResolvedValue(true);
  });

  // Break caught: the entry is missing, or goes to the bare domain's start (the intake is then the default firm's).
  it("at a firm's address that takes intakes is a link that starts one, here at the firm's own address", async () => {
    renderIt();
    const link = await screen.findByRole("link", { name: "Get a quote" });
    expect(link).toHaveAttribute("href", "/start");
    expect(takes).toHaveBeenCalledWith("alpha-advisory");
  });

  // Break caught: a dead button (D-402): the link is offered for a firm that is closing, suspended or refused, and the employer finds out after agreeing.
  it("shows nothing for a link that takes no intakes", async () => {
    takes.mockResolvedValue(false);
    const { container } = renderIt();
    await waitFor(() => expect(takes).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole("link", { name: "Get a quote" })).not.toBeInTheDocument();
  });

  // Break caught: the entry shows on the bare domain, where the intake would be the default firm's and this is no firm's page.
  it("shows nothing off a firm's address, and asks nothing", () => {
    firmAddress = { status: "none" };
    const { container } = renderIt();
    expect(container).toBeEmptyDOMElement();
    expect(takes).not.toHaveBeenCalled();
  });
});
