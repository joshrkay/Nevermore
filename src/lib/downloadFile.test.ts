import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./downloadFile";

const blob = new Blob(["%PDF-1.3"], { type: "application/pdf" });

describe("downloadBlob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("saves through a download link carrying the filename, then cleans up", () => {
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    downloadBlob(blob, "The_Manuscript_EAA-1_Acme.pdf");

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("The_Manuscript_EAA-1_Acme.pdf");
    expect(clicked[0].href).toBe("blob:test");
    expect(document.body.contains(clicked[0])).toBe(false);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled(); // kept alive for slow mobile browsers
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("opens the PDF in a tab when the browser ignores the download attribute", () => {
    const original = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "download");
    delete (HTMLAnchorElement.prototype as { download?: string }).download;
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    try {
      downloadBlob(blob, "x.pdf");
      expect(open).toHaveBeenCalledWith("blob:test", "_blank");
    } finally {
      if (original) Object.defineProperty(HTMLAnchorElement.prototype, "download", original);
    }
  });
});
