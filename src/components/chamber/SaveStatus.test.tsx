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
});
