import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Seam 2 (D-13): "Who can see my intake" on the employer's profile (CRM-P2.5, D-1714), the database faked at its API module.
const listMyIntakeFirms = vi.fn();
const endFirmAccess = vi.fn();
vi.mock("@/lib/peoAuthorizationsApi", () => ({
  listMyIntakeFirms: (...a: unknown[]) => listMyIntakeFirms(...a),
  endFirmAccess: (...a: unknown[]) => endFirmAccess(...a),
}));

const { default: MyFirmAccess } = await import("./MyFirmAccess");

describe("MyFirmAccess", () => {
  beforeEach(() => {
    listMyIntakeFirms.mockReset();
    endFirmAccess.mockReset();
  });

  // Break caught: an employer can't tell which firm can see which of their intakes, or has no way to end it; one with two intakes at two firms sees only one.
  it("names the firm that sees each intake, with End <Firm>'s access", async () => {
    listMyIntakeFirms.mockResolvedValue([
      { id: "s1", firm: "Acme Brokers", company: "Acme Co" },
      { id: "s2", firm: "Zenith Benefits", company: "Beta Co" },
    ]);
    render(<MyFirmAccess />);
    expect(await screen.findByText("Acme Co is seen by Acme Brokers.")).toBeInTheDocument();
    expect(screen.getByText("Beta Co is seen by Zenith Benefits.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End Acme Brokers's access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End Zenith Benefits's access" })).toBeInTheDocument();
  });

  // Break caught: access ended with one click and no reading (the firm can't undo it), or the confirmation says nothing of what ending does; the wrong
  // intake is ended; the row goes on offering the ending after it was done.
  it("asks first, in draft wording, then ends that intake's access and says it is ended", async () => {
    listMyIntakeFirms.mockResolvedValue([{ id: "s1", firm: "Acme Brokers", company: "Acme Co" }, { id: "s2", firm: "Zenith Benefits", company: "Beta Co" }]);
    endFirmAccess.mockResolvedValue(undefined);
    render(<MyFirmAccess />);
    fireEvent.click(await screen.findByRole("button", { name: "End Zenith Benefits's access" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Zenith Benefits will no longer see your answers/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Draft wording, not yet reviewed by counsel/)).toBeInTheDocument();
    expect(endFirmAccess).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "End Zenith Benefits's access" }));
    await waitFor(() => expect(endFirmAccess).toHaveBeenCalledWith("s2"));
    expect(endFirmAccess).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Zenith Benefits can no longer see Beta Co.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End Zenith Benefits's access" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End Acme Brokers's access" })).toBeInTheDocument();
  });

  // Break caught: a refusal (the intake isn't theirs, no firm sees it any more) is swallowed, so the profile says nothing and the employer thinks it is done.
  it("shows the database's own words when it refuses, and goes on offering the ending", async () => {
    listMyIntakeFirms.mockResolvedValue([{ id: "s1", firm: "Acme Brokers", company: "Acme Co" }]);
    endFirmAccess.mockRejectedValueOnce(Object.assign(new Error("No firm sees this intake, so there is nothing to end."), { code: "22023" }));
    render(<MyFirmAccess />);
    fireEvent.click(await screen.findByRole("button", { name: "End Acme Brokers's access" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "End Acme Brokers's access" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No firm sees this intake, so there is nothing to end.");
    expect(screen.queryByText("Acme Brokers can no longer see Acme Co.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End Acme Brokers's access" })).toBeInTheDocument();
  });

  // Break caught: an employer no firm sees gets an empty heading and can't tell whether the page failed or nothing is shared.
  it("says when no firm sees any of their intakes", async () => {
    listMyIntakeFirms.mockResolvedValue([]);
    render(<MyFirmAccess />);
    expect(await screen.findByText("No firm can see your intake.")).toBeInTheDocument();
  });

  // Break caught: a failed load reads as "no firm can see your intake" (the employer is told they are safe when we don't know), and the rejection goes unhandled.
  it("says when the list could not be loaded, and does not say no firm sees it", async () => {
    listMyIntakeFirms.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<MyFirmAccess />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load who can see your intake. Reload the page to try again.");
    expect(screen.queryByText("No firm can see your intake.")).not.toBeInTheDocument();
  });

  // Break caught: closing the question (Keep) ends the access anyway, which the firm can't undo.
  it("ends nothing when the employer keeps the firm's access", async () => {
    listMyIntakeFirms.mockResolvedValue([{ id: "s1", firm: "Acme Brokers", company: "Acme Co" }]);
    render(<MyFirmAccess />);
    fireEvent.click(await screen.findByRole("button", { name: "End Acme Brokers's access" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep Acme Brokers's access" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(endFirmAccess).not.toHaveBeenCalled();
    expect(screen.getByText("Acme Co is seen by Acme Brokers.")).toBeInTheDocument();
  });
});
