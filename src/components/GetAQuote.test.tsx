import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { FirmAddress } from "@/hooks/useFirmAddress";

// "Get a quote" on a firm's public page (P-2.1, D-1746), shown only where the firm's link takes intakes.
let firmAddress: FirmAddress = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
const takes = vi.fn();
vi.mock("@/lib/firmApi", () => ({ fetchFirmTakesIntakes: (address: string) => takes(address) }));

const { default: GetAQuote } = await import("./GetAQuote");

const renderIt = () =>
  render(
    <MemoryRouter>
      <GetAQuote />
    </MemoryRouter>,
  );

describe("GetAQuote", () => {
  beforeEach(() => {
    firmAddress = { status: "known", address: "alpha-advisory", name: "Alpha Advisory" };
    takes.mockReset();
    takes.mockResolvedValue(true);
  });

  // Break caught: no way in from a firm's page to an intake filed in that firm.
  it("at a firm's address that takes intakes is a link that starts one", async () => {
    renderIt();
    expect(await screen.findByRole("link", { name: "Get a quote" })).toHaveAttribute("href", "/start");
    expect(takes).toHaveBeenCalledWith("alpha-advisory");
  });

  // Break caught: the bare domain offers "Get a quote", which has no firm to file the intake in.
  it("shows nothing, and asks nothing, off a firm's address", async () => {
    firmAddress = { status: "none" };
    renderIt();
    await act(async () => undefined);
    expect(screen.queryByRole("link", { name: "Get a quote" })).not.toBeInTheDocument();
    expect(takes).not.toHaveBeenCalled();
  });

  // Break caught: a failed lookup throws out of the page or hides the entry for good; the intake's first screen says so if the link takes none.
  it("still offers the link when the link's answer can't be had", async () => {
    takes.mockRejectedValue(new Error("Couldn't check this link."));
    renderIt();
    expect(await screen.findByRole("link", { name: "Get a quote" })).toHaveAttribute("href", "/start");
  });

  // Break caught: the page that places the link can't style it as its other buttons.
  it("takes the class the page styles it with", async () => {
    render(
      <MemoryRouter>
        <GetAQuote className="btn-primary" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("link", { name: "Get a quote" })).toHaveClass("btn-primary");
  });

  // Break caught: a button that leads to a refusal, for a refused, suspended or closing firm (D-402).
  it("shows nothing at a link that takes no intakes", async () => {
    takes.mockResolvedValue(false);
    renderIt();
    await waitFor(() => expect(takes).toHaveBeenCalled());
    await act(async () => undefined);
    expect(screen.queryByRole("link", { name: "Get a quote" })).not.toBeInTheDocument();
  });
});
