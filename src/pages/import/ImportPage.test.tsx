import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "@/components/workspace/workspaceContext";
import type { PastImport } from "@/lib/importApi";

// The import page (CRM-X4.1): choose, match, review, import, and the list of imports with undo. The database is faked at src/lib/importApi; the file is
// read for real (src/data/import.ts).
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "ada@example.com" }, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const api = { loadImports: vi.fn(), reviewImport: vi.fn(), runImport: vi.fn(), undoImport: vi.fn(), loadImportProblems: vi.fn() };
vi.mock("@/lib/importApi", () => api);
const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));

const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");
const { default: ImportPage } = await import("./ImportPage");
const { toast } = await import("sonner");

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  firm: { id: "f1", name: "Acme Brokers", address: "acme-brokers" }, role: "Owner", isOwner: true, isSupport: false, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "Ada", ...over,
});
const show = (w: Workspace = workspace()) => render(<MemoryRouter><WorkspaceContext.Provider value={w}><ImportPage /></WorkspaceContext.Provider></MemoryRouter>);
const csv = (text: string, name = "book.csv") => {
  const f = new File([text], name, { type: "text/csv" });
  // jsdom's File has no text(): the page reads the file with it.
  Object.defineProperty(f, "text", { value: () => Promise.resolve(text) });
  return f;
};
const pick = async (text: string, name?: string) => {
  fireEvent.change(await screen.findByLabelText("CSV file"), { target: { files: [csv(text, name)] } });
};
const past = (over: Partial<PastImport> = {}): PastImport => ({
  id: "i1", kind: "accounts", fileName: "old.csv", totalRows: 5, createdBy: "Ada", createdAt: "2026-11-20T10:00:00Z", created: 3, exists: 1, failed: 1, undoneAt: null, canUndo: true, ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  downloadBlob.mockReset();
  api.loadImports.mockResolvedValue([]);
});

describe("the import page", () => {
  // Break caught: an agent shown a form the database refuses at its last step.
  it("tells someone who is neither an owner nor a lead that they can't import, and reads nothing", () => {
    show(workspace({ isOwner: false, role: "Agent" }));
    expect(screen.getByText(/Only an owner or a lead of the firm imports\./)).toBeInTheDocument();
    expect(screen.queryByLabelText("CSV file")).toBeNull();
    expect(api.loadImports).not.toHaveBeenCalled();
  });

  it("says what is wrong with a file that can't be read, and offers nothing to match", async () => {
    show();
    await pick("Name,State\n");
    expect(await screen.findByText("The file has column names and no rows under them.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check the file" })).toBeNull();
  });

  // Break caught: a proposed match the person can't see or change, or a column silently dropped.
  it("proposes a field for each column, shows a first value beside it, and lets one be changed", async () => {
    show();
    await pick("Company,First Name,Last Name,Email,Shoe size\nCole Plumbing,Dana,Cole,dana@cole.example,9\n");
    expect(await screen.findByText("book.csv: 1 row. We proposed a field where a column's name reads as one; change any that are wrong.")).toBeInTheDocument();
    expect((screen.getByLabelText("Field for Company") as HTMLSelectElement).value).toBe("name");
    expect((screen.getByLabelText("Field for Email") as HTMLSelectElement).value).toBe("contact_email");
    expect((screen.getByLabelText("Field for Shoe size") as HTMLSelectElement).value).toBe("");
    expect(screen.getByText("Cole Plumbing")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Field for Shoe size"), { target: { value: "employees" } });
    expect((screen.getByLabelText("Field for Shoe size") as HTMLSelectElement).value).toBe("employees");
  });

  it("won't check a file with no column matched to the name, and says which field is missing", async () => {
    show();
    await pick("Email\ndana@cole.example\n");
    fireEvent.change(await screen.findByLabelText("What the file holds"), { target: { value: "leads" } });
    expect(await screen.findByText("Match a column to Name: every row needs one.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check the file" })).toBeDisabled();
  });

  // Break caught: the import run on rows the review never saw, or run before the person has read what it will do.
  it("reviews the matched rows, says what will be made, already here and can't be imported, then imports the same rows", async () => {
    api.reviewImport.mockResolvedValue({ create: 1, exists: 1, failed: 1, problems: [{ row: 3, outcome: "exists", reason: "An account that matches this one is already here" }, { row: 4, outcome: "failed", reason: "Employees must be a whole number, like 25" }] });
    api.runImport.mockResolvedValue({ created: 1, exists: 1, failed: 1, importId: "i9" });
    show();
    await pick("Company,Employees\nCole Plumbing,40\nOld Co,5\nBad Co,many\n");
    expect(screen.queryByRole("button", { name: /^Import / })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Check the file" }));
    const will = within(await screen.findByRole("list", { name: "What the import will do" })).getAllByRole("listitem").map((l) => l.textContent);
    expect(will).toEqual(["1 row will make a new account.", "1 already here, and will be left as they are.", "1 can't be imported."]);
    const rowsSent = [{ _row: 2, name: "Cole Plumbing", employees: "40" }, { _row: 3, name: "Old Co", employees: "5" }, { _row: 4, name: "Bad Co", employees: "many" }];
    expect(api.reviewImport).toHaveBeenCalledWith("f1", "accounts", rowsSent, expect.any(Function));
    const problems = within(screen.getByRole("list", { name: "Rows that won't be imported" })).getAllByRole("listitem").map((l) => l.textContent);
    expect(problems).toEqual(["Row 3: An account that matches this one is already here", "Row 4: Employees must be a whole number, like 25"]);
    fireEvent.click(screen.getByRole("button", { name: "Import 1 row" }));
    await waitFor(() => expect(api.runImport).toHaveBeenCalledWith("f1", "accounts", "book.csv", rowsSent, expect.any(Function)));
    expect(await screen.findByText("1 made, 1 already here, 1 not imported.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Accounts" })).toHaveAttribute("href", "/accounts");
  });

  it("changing a match after the review takes the review away, so nothing is imported unreviewed", async () => {
    api.reviewImport.mockResolvedValue({ create: 1, exists: 0, failed: 0, problems: [] });
    show();
    await pick("Company,City\nCole Plumbing,Austin\n");
    fireEvent.click(await screen.findByRole("button", { name: "Check the file" }));
    await screen.findByRole("button", { name: "Import 1 row" });
    fireEvent.change(screen.getByLabelText("Field for City"), { target: { value: "" } });
    expect(screen.queryByRole("button", { name: "Import 1 row" })).toBeNull();
  });

  it("offers no import when nothing in the file would make a record", async () => {
    api.reviewImport.mockResolvedValue({ create: 0, exists: 1, failed: 0, problems: [{ row: 2, outcome: "exists", reason: "An account that matches this one is already here" }] });
    show();
    await pick("Company\nOld Co\n");
    fireEvent.click(await screen.findByRole("button", { name: "Check the file" }));
    expect(await screen.findByText("Nothing in this file would make a new record.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 0 rows" })).toBeDisabled();
  });

  // CRM-X4.1's "rows in error ... can be downloaded, fixed and imported again".
  it("gives the rows that won't be imported as a file, each with its row number and why", async () => {
    api.reviewImport.mockResolvedValue({ create: 0, exists: 0, failed: 1, problems: [{ row: 2, outcome: "failed", reason: "Employees must be a whole number, like 25" }] });
    show();
    await pick("Company,Employees\nBad Co,many\n");
    fireEvent.click(await screen.findByRole("button", { name: "Check the file" }));
    fireEvent.click(await screen.findByRole("button", { name: "Download these rows, to fix and import again" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
    expect(name).toBe("rows-not-imported.csv");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("shows a refused check or import in the database's words and keeps the file and its matching", async () => {
    api.reviewImport.mockRejectedValue(new Error("This firm is closing and can't be changed"));
    show();
    await pick("Company\nCole Plumbing\n");
    fireEvent.click(await screen.findByRole("button", { name: "Check the file" }));
    expect(await screen.findByText("This firm is closing and can't be changed")).toBeInTheDocument();
    expect((screen.getByLabelText("Field for Company") as HTMLSelectElement).value).toBe("name");
  });
});

describe("the firm's imports", () => {
  it("lists each with who ran it and what it made, and says nothing has been imported when none has", async () => {
    show();
    expect(await screen.findByText("Nothing has been imported yet.")).toBeInTheDocument();
  });

  // Break caught: Undo offered after its 30 days, or the list left showing an import as it was before it was undone.
  it("undoes an import that can still be undone, says what was removed and what was kept, and reads the list again", async () => {
    api.loadImports.mockResolvedValueOnce([past(), past({ id: "i2", fileName: "older.csv", canUndo: false })]).mockResolvedValueOnce([past({ undoneAt: "2026-11-24T12:00:00Z", canUndo: false })]);
    api.undoImport.mockResolvedValue({ removed: 2, kept: 1 });
    show();
    const rows = within(await screen.findByRole("list", { name: "Imports" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("old.csv · Accounts with their contacts");
    expect(rows[0]).toHaveTextContent("Nov 20, 2026 by Ada · 3 made, 1 already here, 1 not imported");
    expect(within(rows[1]).queryByRole("button", { name: /Undo/ })).toBeNull();
    fireEvent.click(within(rows[0]).getByRole("button", { name: "Undo the import of old.csv" }));
    await waitFor(() => expect(api.undoImport).toHaveBeenCalledWith("f1", "i1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Undone: 2 removed. 1 kept because it has moved on since (a converted lead, or an account with an opportunity)."));
    expect(await screen.findByText(/Undone Nov 24, 2026/)).toBeInTheDocument();
  });

  it("downloads the rows of a past import that weren't imported", async () => {
    api.loadImports.mockResolvedValue([past()]);
    api.loadImportProblems.mockResolvedValue([{ row: 4, outcome: "failed", reason: "Enter the contact's last name." }]);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Download the rows of old.csv that weren't imported" }));
    await waitFor(() => expect(api.loadImportProblems).toHaveBeenCalledWith("f1", "i1"));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
  });
});
