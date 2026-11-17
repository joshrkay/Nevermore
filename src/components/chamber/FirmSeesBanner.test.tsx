import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRAFT_WORDING_NOTICE, firmSeesAnswersText } from "@/data/legalWording";

const api = { listMyIntakeFirms: vi.fn() };
vi.mock("@/lib/peoAuthorizationsApi", () => api);

const { default: FirmSeesBanner } = await import("./FirmSeesBanner");

const row = (over: Record<string, unknown> = {}) => ({ id: "s1", firm: "Acme Brokers", company: "Acme Co", invitedBy: "Ana Agent", invitedAt: new Date("2026-11-20T10:00:00Z"), ...over });

// What the employer sees on their own intake when a firm can see it (CRM-Q2.3, D-1880..D-1882).
describe("FirmSeesBanner", () => {
  beforeEach(() => {
    api.listMyIntakeFirms.mockReset().mockResolvedValue([row()]);
  });
  afterEach(cleanup);

  // Break caught: the employer works an intake without being told which firm, and which person in it, invited them, or that the firm can see what they enter.
  it("names the firm and who invited them, and says the firm can see their answers, in the draft wording", async () => {
    render(<FirmSeesBanner sessionId="s1" />);
    expect(await screen.findByText("You were invited by Ana Agent of Acme Brokers.")).toBeInTheDocument();
    expect(screen.getByText(firmSeesAnswersText("Acme Brokers"))).toBeInTheDocument();
    expect(screen.getByText(DRAFT_WORDING_NOTICE)).toBeInTheDocument();
  });

  // Break caught: an intake nobody invited (started at the firm's link) says "invited by null of ..." or claims an invitation that never happened.
  it("names only the firm when no one invited them", async () => {
    api.listMyIntakeFirms.mockResolvedValue([row({ invitedBy: null, invitedAt: null })]);
    render(<FirmSeesBanner sessionId="s1" />);
    expect(await screen.findByText("This intake is with Acme Brokers.")).toBeInTheDocument();
    expect(screen.queryByText(/You were invited/)).not.toBeInTheDocument();
    expect(screen.getByText(firmSeesAnswersText("Acme Brokers"))).toBeInTheDocument();
  });

  // Break caught: a dropped connection while reading who invited them breaks the employer's intake (an unhandled error), or shows a banner with nothing in it.
  it("leaves the intake alone when the firm can't be read", async () => {
    api.listMyIntakeFirms.mockRejectedValue(new Error("offline"));
    render(<FirmSeesBanner sessionId="s1" />);
    await waitFor(() => expect(api.listMyIntakeFirms).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  // Break caught: an intake no outside firm sees (the employer's own, or the default firm's) is shown a banner naming another intake's firm.
  it("says nothing about an intake no firm sees, nor names the firm of another of their intakes", async () => {
    api.listMyIntakeFirms.mockResolvedValue([row({ id: "other" })]);
    render(<FirmSeesBanner sessionId="s1" />);
    await waitFor(() => expect(api.listMyIntakeFirms).toHaveBeenCalled());
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.queryByText(/Acme Brokers/)).not.toBeInTheDocument();
  });
});
