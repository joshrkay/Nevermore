import { describe, expect, it } from "vitest";
import { documentStatusChanges, shownDocumentStatus } from "./documentStatus";

const doc = (id: string, status: string, scan_verdict = "clean", file_name = `${id}.pdf`) => ({ id, file_name, status, scan_verdict });

describe("shownDocumentStatus", () => {
  it("shows the virus check until it passes, but not while the file uploads", () => {
    expect(shownDocumentStatus("uploading", "pending").status.label).toBe("Uploading…");
    expect(shownDocumentStatus("uploaded", "pending").status.label).toBe("Checking for viruses");
    expect(shownDocumentStatus("uploaded", "infected").status.label).toBe("Blocked");
    expect(shownDocumentStatus("processing", "clean")).toEqual({ scan: null, status: expect.objectContaining({ label: "Reading…" }) });
    expect(shownDocumentStatus("extracted", "skipped").status.label).toBe("Read");
  });
});

describe("documentStatusChanges", () => {
  it("names each file that is new or whose state changed, and nothing else", () => {
    const first = documentStatusChanges(new Map(), [doc("a", "uploaded", "pending")]);
    expect(first.lines).toEqual(["a.pdf: Checking for viruses"]);
    const second = documentStatusChanges(first.labels, [doc("a", "processing"), doc("b", "uploading", "pending")]);
    expect(second.lines).toEqual(["a.pdf: Reading…", "b.pdf: Uploading…"]);
    const same = documentStatusChanges(second.labels, [doc("a", "processing"), doc("b", "uploading", "pending")]);
    expect(same.lines).toEqual([]);
  });

  it("says how reading went", () => {
    const reading = documentStatusChanges(new Map(), [doc("a", "processing")]).labels;
    expect(documentStatusChanges(reading, [doc("a", "extracted")]).lines).toEqual(["a.pdf: Read"]);
    expect(documentStatusChanges(reading, [doc("a", "encrypted")]).lines).toEqual(["a.pdf: Password-protected"]);
  });

  it("doesn't mention a file the prospect removed", () => {
    const labels = documentStatusChanges(new Map(), [doc("a", "extracted"), doc("b", "extracted")]).labels;
    const after = documentStatusChanges(labels, [doc("a", "extracted")]);
    expect(after.lines).toEqual([]);
    expect([...after.labels.keys()]).toEqual(["a"]);
  });
});
