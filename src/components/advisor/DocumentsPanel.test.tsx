import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReviewedDocument } from "@/data/advisor";

// A member opens a prospect's file through a link made for that click (CRM-P2.2): the page asks Storage for a link that lasts
// 60 seconds, for that one file, hands it to the browser to save, and asks again next time; if Storage won't make one (the caller
// isn't a member of the intake's firm: supabase/tests/data_isolation.sql proves who that is) the browser is given nothing. Only
// the Supabase client, the page's edge to Storage, is faked.

const createSignedUrl = vi.fn();
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    storage: { from: (bucket: string) => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(bucket, ...a) }) },
  },
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

const { default: DocumentsPanel } = await import("./DocumentsPanel");
const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");

const doc: ReviewedDocument = {
  id: "d1", file_name: "census.xlsx", file_size: "12 KB", category: "census", status: "ready",
  storage_path: "u1/s1/census.xlsx", created_at: "2026-10-01T12:00:00Z", scan_verdict: "clean",
};

const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
});

const open = () => fireEvent.click(screen.getByRole("button", { name: "Open census.xlsx" }));

describe("opening an uploaded document", () => {
  it("is given a link to that one file that lasts 60 seconds, saved under its own name, and hands it to the browser", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example/sign/1" }, error: null });
    render(<DocumentsPanel documents={[doc]} events={[]} prospectUserId="u1" />);
    open();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://storage.example/sign/1"));
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(createSignedUrl).toHaveBeenCalledWith("documents", "u1/s1/census.xlsx", 60, { download: "census.xlsx" });
  });

  it("makes a new link at every opening and never reuses the last one", async () => {
    createSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example/sign/1" }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: "https://storage.example/sign/2" }, error: null });
    render(<DocumentsPanel documents={[doc]} events={[]} prospectUserId="u1" />);
    open();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    open();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(2));
    expect(assign.mock.calls.map((c) => c[0])).toEqual(["https://storage.example/sign/1", "https://storage.example/sign/2"]);
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("gives the browser nothing, says so plainly and records no download when Storage won't make a link", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "Object not found" } });
    render(<DocumentsPanel documents={[doc]} events={[]} prospectUserId="u1" />);
    open();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Object not found"));
    expect(assign).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    // And the page is usable again: the button is not left spinning.
    await waitFor(() => expect(screen.getByRole("button", { name: "Open census.xlsx" })).toBeEnabled());
  });

  it("records the opening, naming the document and never the link", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example/sign/secret-token" }, error: null });
    render(<DocumentsPanel documents={[doc]} events={[]} prospectUserId="u1" />);
    open();
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("record_member_activity", { p_kind: "document_downloaded", p_record_type: "document", p_record_id: "d1" });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("secret-token");
  });

  it("offers no link for a file still being scanned or blocked by the scan", () => {
    render(<DocumentsPanel documents={[{ ...doc, scan_verdict: "pending" }]} events={[]} prospectUserId="u1" />);
    expect(screen.getByRole("button", { name: "Open census.xlsx" })).toBeDisabled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});

// Catches: a support session is shown "Open" on a file and meets "Couldn't open that file", or the fix takes the button from a member.
describe("during Nevermore support", () => {
  const workspace = (isSupport: boolean) => ({ firm: null, role: null, isOwner: false, isSupport, supportEndsAt: null, supportSessionId: null, isPlatformAdmin: isSupport, person: "Sam" });
  it("offers no way to open a file and says so in one line, while the row says the file is there", () => {
    render(<WorkspaceContext.Provider value={workspace(true)}><DocumentsPanel documents={[doc]} events={[]} prospectUserId="u1" /></WorkspaceContext.Provider>);
    expect(screen.queryByRole("button", { name: "Open census.xlsx" })).not.toBeInTheDocument();
    expect(screen.getByText("census.xlsx")).toBeInTheDocument();
    expect(screen.getAllByText("Downloads are off during Nevermore support.")).toHaveLength(1);
  });
  it("still offers it to a member", () => {
    render(<WorkspaceContext.Provider value={workspace(false)}><DocumentsPanel documents={[doc]} events={[]} prospectUserId="u1" /></WorkspaceContext.Provider>);
    expect(screen.getByRole("button", { name: "Open census.xlsx" })).toBeInTheDocument();
    expect(screen.queryByText("Downloads are off during Nevermore support.")).not.toBeInTheDocument();
  });
});
