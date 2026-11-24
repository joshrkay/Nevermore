import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirmLicenceRecord } from "@/lib/marketApi";

// The firm's producer number and licences on record (BR-2.2): an owner keeps them, a member reads them, a platform admin reads them and records the check.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "gus@example.com" }, signOut: vi.fn() }) }));
const api = {
  loadFirmLicenceRecord: vi.fn(), loadAdminFirmLicenceRecord: vi.fn(), setFirmNpn: vi.fn(), addFirmLicence: vi.fn(), removeFirmLicence: vi.fn(), recordLicenceCheck: vi.fn(),
  LICENCE_LINE_LABELS: { life_health: "Life and health", property_casualty: "Property and casualty" },
};
vi.mock("@/lib/marketApi", () => api);
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { AdminFirmLicences, FirmLicences } = await import("./FirmLicences");

const record = (over: Partial<FirmLicenceRecord> = {}): FirmLicenceRecord => ({
  npn: "1234567", licences: [{ id: 3, state: "TX", line: "property_casualty", licenceNumber: "L-1", expiresOn: "2027-06-30", expired: false }],
  checkedAt: null, changedSinceCheck: false, canChange: true, ...over,
});

beforeEach(() => Object.values(api).forEach((f) => typeof f === "function" && f.mockReset()));

describe("the firm's licences, on Settings", () => {
  it("shows an owner the number and each licence, and that Nevermore has not checked them yet", async () => {
    api.loadFirmLicenceRecord.mockResolvedValue(record());
    render(<FirmLicences firmId="f1" />);
    expect(await screen.findByLabelText("National Producer Number")).toHaveValue("1234567");
    const row = within(screen.getByRole("list", { name: "Licences on record" })).getByRole("listitem");
    expect(row).toHaveTextContent("TX · Property and casualty");
    expect(row).toHaveTextContent("Number L-1 · Expires Jun 30, 2027");
    expect(screen.getByText("Nevermore has not checked these yet.")).toBeInTheDocument();
    expect(screen.queryByText(/nothing can be sent to a carrier yet/)).toBeNull();
  });

  // Break caught: a firm with a life and health licence alone, or a lapsed one, not told why its carrier sends are refused.
  it.each([
    ["no licence at all", []],
    ["a life and health licence alone", [{ id: 1, state: "TX", line: "life_health" as const, licenceNumber: null, expiresOn: null, expired: false }]],
    ["a lapsed property and casualty licence", [{ id: 1, state: "TX", line: "property_casualty" as const, licenceNumber: null, expiresOn: "2026-01-01", expired: true }]],
  ])("says nothing can be sent to a carrier with %s", async (_what, licences) => {
    api.loadFirmLicenceRecord.mockResolvedValue(record({ licences }));
    render(<FirmLicences firmId="f1" />);
    expect(await screen.findByText("No property and casualty licence is on record, so nothing can be sent to a carrier yet.")).toBeInTheDocument();
  });

  it("marks a lapsed licence as expired, in words", async () => {
    api.loadFirmLicenceRecord.mockResolvedValue(record({ licences: [{ id: 1, state: "TX", line: "property_casualty", licenceNumber: null, expiresOn: "2026-01-01", expired: true }] }));
    render(<FirmLicences firmId="f1" />);
    expect(await screen.findByText("Expired Jan 1, 2026")).toBeInTheDocument();
  });

  // Break caught: an agent offered forms the database refuses.
  it("shows a member who is no owner the record with nothing to change", async () => {
    api.loadFirmLicenceRecord.mockResolvedValue(record({ canChange: false }));
    render(<FirmLicences firmId="f1" />);
    expect(await screen.findByText("National Producer Number: 1234567")).toBeInTheDocument();
    expect(screen.getByText(/An owner of the firm keeps these\./)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Add a licence" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save the number" })).toBeNull();
  });

  it("adds a licence with the state in capitals, and reads the record again", async () => {
    api.loadFirmLicenceRecord.mockResolvedValue(record({ licences: [] }));
    api.addFirmLicence.mockResolvedValue(undefined);
    render(<FirmLicences firmId="f1" />);
    const form = await screen.findByRole("form", { name: "Add a licence" });
    fireEvent.change(within(form).getByLabelText("State (required)"), { target: { value: "ok" } });
    fireEvent.change(within(form).getByLabelText("Expires"), { target: { value: "2027-01-31" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add licence" }));
    await waitFor(() => expect(api.addFirmLicence).toHaveBeenCalledWith("f1", { state: "OK", line: "property_casualty", licenceNumber: "", expiresOn: "2027-01-31" }));
    await waitFor(() => expect(api.loadFirmLicenceRecord).toHaveBeenCalledTimes(2));
  });

  it("saves a changed number, removes a licence by its own button, and shows a refusal in the database's words", async () => {
    api.loadFirmLicenceRecord.mockResolvedValue(record());
    api.setFirmNpn.mockRejectedValue(new Error("A National Producer Number is up to 10 digits"));
    api.removeFirmLicence.mockResolvedValue(undefined);
    render(<FirmLicences firmId="f1" />);
    const save = await screen.findByRole("button", { name: "Save the number" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("National Producer Number"), { target: { value: "12AB" } });
    fireEvent.click(save);
    expect(await screen.findByText("A National Producer Number is up to 10 digits")).toBeInTheDocument();
    expect(api.setFirmNpn).toHaveBeenCalledWith("f1", "12AB");
    fireEvent.click(screen.getByRole("button", { name: "Remove the TX property and casualty licence" }));
    await waitFor(() => expect(api.removeFirmLicence).toHaveBeenCalledWith("f1", 3));
  });

  it("says when Nevermore checked them, and when they changed since", async () => {
    api.loadFirmLicenceRecord.mockResolvedValue(record({ checkedAt: "2026-11-20T15:00:00Z", changedSinceCheck: true }));
    render(<FirmLicences firmId="f1" />);
    expect(await screen.findByText("Changed since Nevermore checked them on Nov 20, 2026.")).toBeInTheDocument();
  });
});

describe("a platform admin's view of a waiting firm's licences", () => {
  // Break caught: every waiting firm's licences read as the page opens, or a check recorded for licences the admin never saw.
  it("reads them only when asked, then records the check and reads them again", async () => {
    api.loadAdminFirmLicenceRecord.mockResolvedValueOnce(record({ canChange: false })).mockResolvedValueOnce(record({ canChange: false, checkedAt: "2026-11-27T15:00:00Z" }));
    api.recordLicenceCheck.mockResolvedValue(undefined);
    render(<AdminFirmLicences firmId="f1" firmName="Acme Brokers" />);
    expect(api.loadAdminFirmLicenceRecord).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show Acme Brokers's licences" }));
    const group = await screen.findByRole("group", { name: "Acme Brokers's licences" });
    expect(group).toHaveTextContent("National Producer Number: 1234567");
    expect(group).toHaveTextContent("TX · Property and casualty");
    expect(within(group).queryByRole("button", { name: /Remove/ })).toBeNull();
    fireEvent.click(within(group).getByRole("button", { name: "Record that I checked these" }));
    await waitFor(() => expect(api.recordLicenceCheck).toHaveBeenCalledWith("f1"));
    expect(await screen.findByText("Nevermore checked these on Nov 27, 2026.")).toBeInTheDocument();
  });
});
