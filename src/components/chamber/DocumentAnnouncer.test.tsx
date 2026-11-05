import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SessionDocument } from "@/hooks/useSessionDocuments";
import DocumentAnnouncer from "./DocumentAnnouncer";

const doc = (id: string, status: string, scan_verdict = "clean") =>
  ({ id, file_name: `${id}.pdf`, status, scan_verdict, category: "other", created_at: "2026-11-04T12:00:00Z" }) as SessionDocument;

const region = () => screen.getByTestId("document-announcer");

describe("DocumentAnnouncer", () => {
  it("is a polite status region", () => {
    render(<DocumentAnnouncer docs={[]} loading={false} />);
    expect(region()).toHaveAttribute("role", "status");
    expect(region()).toHaveAttribute("aria-live", "polite");
  });

  it("doesn't read out the files an intake opens with", () => {
    const { rerender } = render(<DocumentAnnouncer docs={[]} loading />);
    rerender(<DocumentAnnouncer docs={[doc("a", "extracted"), doc("b", "uploaded", "pending")]} loading={false} />);
    expect(region()).toBeEmptyDOMElement();
  });

  it("reads out an upload, its virus check, and Lenore reading it", () => {
    const { rerender } = render(<DocumentAnnouncer docs={[]} loading={false} />);
    rerender(<DocumentAnnouncer docs={[doc("a", "uploading", "pending")]} loading={false} />);
    expect(region()).toHaveTextContent("a.pdf: Uploading…");
    rerender(<DocumentAnnouncer docs={[doc("a", "uploaded", "pending")]} loading={false} />);
    expect(region()).toHaveTextContent("a.pdf: Checking for viruses");
    rerender(<DocumentAnnouncer docs={[doc("a", "processing")]} loading={false} />);
    expect(region()).toHaveTextContent("a.pdf: Reading…");
    rerender(<DocumentAnnouncer docs={[doc("a", "extracted")]} loading={false} />);
    expect(region()).toHaveTextContent("a.pdf: Read");
  });

  it("puts each change in a new node, so the same words twice are read twice", () => {
    const { rerender } = render(<DocumentAnnouncer docs={[]} loading={false} />);
    rerender(<DocumentAnnouncer docs={[doc("a", "processing")]} loading={false} />);
    const before = region().firstElementChild;
    rerender(<DocumentAnnouncer docs={[doc("a", "processing"), doc("b", "processing")]} loading={false} />);
    expect(region()).toHaveTextContent("b.pdf: Reading…");
    expect(region().firstElementChild).not.toBe(before);
  });
});
