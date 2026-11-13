import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const fetchFirmName = vi.fn();
vi.mock("@/lib/firmApi", () => ({ fetchFirmName: (...a: unknown[]) => fetchFirmName(...a) }));

const { FirmAddressProvider, useFirmAddress } = await import("./useFirmAddress");

const Show = () => {
  const firm = useFirmAddress();
  return <p>{firm.status === "known" ? `known: ${firm.name}` : firm.status}</p>;
};
const tree = (hostname: string) => (
  <FirmAddressProvider hostname={hostname}>
    <Show />
  </FirmAddressProvider>
);

describe("the firm the host names", () => {
  beforeEach(() => { fetchFirmName.mockReset(); });

  it("is no firm, and asks nothing, on the bare domain", () => {
    render(tree("nevermorepeo.com"));
    expect(screen.getByText("none")).toBeInTheDocument();
    expect(fetchFirmName).not.toHaveBeenCalled();
  });

  it("is unknown when nothing comes back for the address", async () => {
    fetchFirmName.mockResolvedValue(null);
    render(tree("nobody.nevermorepeo.com"));
    expect(await screen.findByText("unknown")).toBeInTheDocument();
  });

  it("never gives one address the name looked up for another", async () => {
    fetchFirmName.mockImplementation(async (address: string) => (address === "acme" ? "Acme Brokers" : new Promise(() => {})));
    const { rerender } = render(tree("acme.nevermorepeo.com"));
    expect(await screen.findByText("known: Acme Brokers")).toBeInTheDocument();
    rerender(tree("birch.nevermorepeo.com"));
    expect(screen.getByText("checking")).toBeInTheDocument();
    expect(screen.queryByText("known: Acme Brokers")).not.toBeInTheDocument();
  });
});
