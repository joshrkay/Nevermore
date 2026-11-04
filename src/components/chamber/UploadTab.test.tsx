// What the Upload tab says about a read that didn't go through, and when it offers to read the file
// again: never while reading again can't help (the daily cap, a Lenore that isn't set up), B-3.2. And the census
// template it offers (US-2.3d).
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import UploadTab from "./UploadTab";
import { CENSUS_TEMPLATE_COLUMNS, CENSUS_TEMPLATE_GUIDE, censusTemplateCsv } from "@/data/census";
import { DOCUMENT_FAILURE_MESSAGES, type AiFailureKind } from "@/data/aiFailure";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { EMPTY_EXTRACTION } from "@/data/documentCandidates";
import type { SessionDocument, UseSessionDocumentsReturn } from "@/hooks/useSessionDocuments";

const downloadBlob = vi.fn();
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (...args: unknown[]) => downloadBlob(...args) }));

const doc = (status: string, readIssue: AiFailureKind | null): SessionDocument => ({
  id: "d1",
  file_name: "benefits.pdf",
  file_size: "120 KB",
  size_bytes: 122_880,
  mime_type: "application/pdf",
  file_sha256: null,
  category: "benefits_summary",
  status,
  created_at: "2026-11-03T10:00:00Z",
  storage_path: "u/s/benefits.pdf",
  scan_verdict: "clean",
  extraction: EMPTY_EXTRACTION,
  readIssue,
});

const renderTab = (d: SessionDocument) => {
  const extract = vi.fn(async () => {});
  const documents: UseSessionDocumentsReturn = {
    docs: [d],
    isLoading: false,
    uploading: false,
    upload: vi.fn(),
    remove: vi.fn(),
    setCategory: vi.fn(),
    markApplied: vi.fn(),
    extract,
  };
  render(<UploadTab documents={documents} sessionId="s1" data={EMPTY_CHAMBER_DATA} />);
  return { extract };
};

describe("UploadTab: a read that didn't go through", () => {
  // A put-off read leaves the file "uploaded"; one that failed once the model was asked leaves it "failed".
  it.each([
    ["uploaded", "daily_cap"],
    ["uploaded", "unavailable"],
    ["failed", "unavailable"],
  ] as const)("a %s file put off by %s says why and offers no retry, since one can't help today", (status, kind) => {
    renderTab(doc(status, kind));
    expect(screen.getByText(DOCUMENT_FAILURE_MESSAGES[kind], { exact: false })).toBeInTheDocument();
    // Nor do the words promise one now.
    expect(DOCUMENT_FAILURE_MESSAGES[kind]).not.toMatch(/you can try again\.$/);
    expect(screen.queryByRole("button", { name: /Read it|Try again/ })).not.toBeInTheDocument();
  });

  it.each([
    ["uploaded", "rate_limited", "Read it"],
    ["failed", "timeout", "Try again"],
    ["failed", "unreachable", "Try again"],
    ["failed", "failed", "Try again"],
  ] as const)("a %s file that missed a read through %s says why and offers to read it again", (status, kind, button) => {
    const { extract } = renderTab(doc(status, kind));
    expect(screen.getByText(DOCUMENT_FAILURE_MESSAGES[kind], { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it("offers to read a file again after a reload, when it no longer knows why the last read didn't go through", () => {
    renderTab(doc("failed", null));
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it.each(["extracted", "unsupported", "processing"])("offers no read again for a %s file", (status) => {
    renderTab(doc(status, null));
    expect(screen.queryByRole("button", { name: /Read it|Try again/ })).not.toBeInTheDocument();
  });
});

describe("UploadTab: the virus check", () => {
  // Every upload is scanned before anyone can open it (20261104130000_document_scanning.sql).
  it("says a file is being checked, and offers no read until the check passes", () => {
    renderTab({ ...doc("uploaded", null), scan_verdict: "pending" });
    expect(screen.getByText("Checking for viruses.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Read it|Try again/ })).not.toBeInTheDocument();
  });

  it("says a flagged file is blocked, lets the prospect remove it, and doesn't count it as provided", () => {
    renderTab({ ...doc("uploaded", "rate_limited"), scan_verdict: "infected" });
    expect(screen.getByText("Blocked.")).toBeInTheDocument();
    expect(screen.getByText(/flagged this file/)).toBeInTheDocument();
    // Not the read's reason: the virus check is all there is to say about it.
    expect(screen.queryByText(DOCUMENT_FAILURE_MESSAGES.rate_limited, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Read it|Try again/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove benefits.pdf" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Uploaded")).not.toBeInTheDocument();
  });

  it("says a file that couldn't be checked can't be opened yet", () => {
    renderTab({ ...doc("uploaded", null), scan_verdict: "failed" });
    expect(screen.getByText("Couldn't be checked.")).toBeInTheDocument();
  });

  it.each(["clean", "skipped"])("reads a %s file as before", (verdict) => {
    renderTab({ ...doc("uploaded", null), scan_verdict: verdict });
    expect(screen.getByRole("button", { name: "Read it" })).toBeInTheDocument();
    expect(screen.queryByText(/viruses/)).not.toBeInTheDocument();
  });
});
