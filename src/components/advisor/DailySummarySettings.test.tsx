import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A person's own switch for the daily summary and their time zone (BR-3.3). The database is faked at src/lib/summaryApi.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "gus@example.com" }, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const api = { loadMySummarySettings: vi.fn(), saveMySummarySettings: vi.fn() };
vi.mock("@/lib/summaryApi", () => api);
vi.mock("@/lib/homeApi", () => ({ browserTimeZone: () => "America/Chicago" }));

const { DailySummarySettings } = await import("./DailySummarySettings");

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

describe("the daily summary's settings", () => {
  // Break caught: a person shown as opted out when they are in, or offered a list that lacks the zone they saved.
  it("shows whether the person gets it and their time zone, with their browser's zone among the choices", async () => {
    api.loadMySummarySettings.mockResolvedValue({ dailySummary: true, timeZone: "America/New_York" });
    render(<DailySummarySettings />);
    expect(await screen.findByLabelText("Send me the daily summary")).toBeChecked();
    const zone = screen.getByLabelText("Your time zone") as HTMLSelectElement;
    expect(zone.value).toBe("America/New_York");
    expect([...zone.options].map((o) => o.value)).toEqual(expect.arrayContaining(["America/New_York", "America/Chicago"]));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("turns it off and saves both settings together", async () => {
    api.loadMySummarySettings.mockResolvedValue({ dailySummary: true, timeZone: "America/New_York" });
    api.saveMySummarySettings.mockImplementation(async (s) => s);
    render(<DailySummarySettings />);
    fireEvent.click(await screen.findByLabelText("Send me the daily summary"));
    fireEvent.change(screen.getByLabelText("Your time zone"), { target: { value: "America/Chicago" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveMySummarySettings).toHaveBeenCalledWith({ dailySummary: false, timeZone: "America/Chicago" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    expect(screen.getByLabelText("Send me the daily summary")).not.toBeChecked();
  });

  // Break caught: a refused save shown as saved, with the switch left where the person put it and no word why.
  it("says a refused save in the database's words and keeps what was chosen", async () => {
    api.loadMySummarySettings.mockResolvedValue({ dailySummary: true, timeZone: "America/New_York" });
    api.saveMySummarySettings.mockRejectedValue(new Error("Choose a time zone from the list"));
    render(<DailySummarySettings />);
    fireEvent.click(await screen.findByLabelText("Send me the daily summary"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Choose a time zone from the list")).toBeInTheDocument();
    expect(screen.getByLabelText("Send me the daily summary")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("says the settings couldn't be loaded and reads them again on request", async () => {
    api.loadMySummarySettings.mockRejectedValueOnce(new Error("Couldn't load your daily summary settings. Try again.")).mockResolvedValueOnce({ dailySummary: false, timeZone: "America/Denver" });
    render(<DailySummarySettings />);
    fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
    expect(await screen.findByLabelText("Send me the daily summary")).not.toBeChecked();
  });
});
