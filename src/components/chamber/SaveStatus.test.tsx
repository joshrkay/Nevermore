import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SaveStatus from "./SaveStatus";

describe("SaveStatus", () => {
  it("says nothing before anything has changed", () => {
    render(<SaveStatus status="idle" onRetry={() => {}} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says when a save is under way, and when it's done", () => {
    const { rerender } = render(<SaveStatus status="saving" onRetry={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
    rerender(<SaveStatus status="saved" onRetry={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("says when the latest changes aren't saved, and offers a retry", () => {
    const onRetry = vi.fn();
    render(<SaveStatus status="failed" onRetry={onRetry} />);
    expect(screen.getByRole("status")).toHaveTextContent("Not saved");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the polite status region for ordinary states", () => {
    render(<SaveStatus status="failed" onRetry={() => {}} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("interrupts when the intake was changed elsewhere, and offers both ways out", () => {
    const onLoadLatest = vi.fn();
    const onKeepMine = vi.fn();
    render(<SaveStatus status="conflict" onRetry={() => {}} onLoadLatest={onLoadLatest} onKeepMine={onKeepMine} />);
    expect(screen.getByRole("alert")).toHaveTextContent("changed in another tab or device");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load latest" }));
    expect(onLoadLatest).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
    expect(onKeepMine).toHaveBeenCalledTimes(1);
  });

  it("names the answer the server refused, and offers to discard rather than retry", () => {
    const onDiscard = vi.fn();
    render(<SaveStatus status="invalid" onRetry={() => {}} onDiscard={onDiscard} invalidField="HQ state" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Not saved: HQ state isn't valid.");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard my changes" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("still reads sensibly when it can't say which answer", () => {
    render(<SaveStatus status="invalid" onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Not saved: an answer isn't valid.");
  });

  it("offers a new intake when the saved one no longer exists", () => {
    const onStartNew = vi.fn();
    render(<SaveStatus status="missing" onRetry={() => {}} onStartNew={onStartNew} />);
    expect(screen.getByRole("alert")).toHaveTextContent("can no longer be saved");
    fireEvent.click(screen.getByRole("button", { name: "Start a new intake" }));
    expect(onStartNew).toHaveBeenCalledTimes(1);
  });
});
