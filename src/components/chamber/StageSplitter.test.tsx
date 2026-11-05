import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import StageSplitter from "./StageSplitter";
import { COLLAPSE_BELOW, KEY_STEP, MAX_ORB, MIN_ORB, PULL_OPEN_DISTANCE, type StageLayout } from "@/data/stageLayout";

// jsdom has no PointerEvent; React's pointer handlers need one that carries the mouse's coordinates.
beforeAll(() => {
  if (!("PointerEvent" in window)) {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
  }
});

const open = (size: number): StageLayout => ({ collapsed: false, size });
const folded = (size: number): StageLayout => ({ collapsed: true, size });

const renderSplitter = (layout: StageLayout) => {
  const onChange = vi.fn();
  render(<StageSplitter layout={layout} onChange={onChange} controls="stage" />);
  return { onChange, handle: screen.getByRole("separator") };
};

const pointer = (handle: HTMLElement, type: "pointerDown" | "pointerMove" | "pointerUp", clientY: number) =>
  fireEvent[type](handle, { clientY, button: 0, pointerId: 1 });

describe("StageSplitter", () => {
  it("says how far open it is, to a screen reader", () => {
    const { handle } = renderSplitter(open(120));
    expect(handle).toHaveAttribute("aria-orientation", "horizontal");
    expect(handle).toHaveAttribute("aria-controls", "stage");
    expect(handle).toHaveAttribute("aria-valuenow", "120");
    expect(handle).toHaveAttribute("aria-valuetext", expect.stringMatching(/open/i));
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("reads as zero, and folded, when the stage is a bar", () => {
    const { handle } = renderSplitter(folded(120));
    expect(handle).toHaveAttribute("aria-valuenow", "0");
    expect(handle).toHaveAttribute("aria-valuetext", expect.stringMatching(/folded/i));
  });

  describe("the button", () => {
    it("hides the orb of an open stage", () => {
      const { onChange } = renderSplitter(open(120));
      const button = screen.getByRole("button", { name: "Hide the orb" });
      expect(button).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(button);
      expect(onChange).toHaveBeenCalledWith(folded(120));
    });

    it("shows the orb of a folded one, at the size it had", () => {
      const { onChange } = renderSplitter(folded(96));
      const button = screen.getByRole("button", { name: "Show the orb" });
      expect(button).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(button);
      expect(onChange).toHaveBeenCalledWith(open(96));
    });

    it("is not the handle, so pressing it never starts a drag", () => {
      const { onChange, handle } = renderSplitter(open(120));
      expect(handle).not.toContainElement(screen.getByRole("button", { name: "Hide the orb" }));
      pointer(handle, "pointerMove", 400);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("dragging", () => {
    it("resizes the stage as the pointer moves, from where it was pressed", () => {
      const { onChange, handle } = renderSplitter(open(120));
      pointer(handle, "pointerDown", 300);
      pointer(handle, "pointerMove", 270);
      expect(onChange).toHaveBeenLastCalledWith(open(90));
      pointer(handle, "pointerMove", 340);
      expect(onChange).toHaveBeenLastCalledWith(open(160));
    });

    it("folds the stage when pulled far enough up, and opens it again when brought back", () => {
      const { onChange, handle } = renderSplitter(open(120));
      pointer(handle, "pointerDown", 300);
      pointer(handle, "pointerMove", 300 - (120 - COLLAPSE_BELOW) - 5);
      expect(onChange).toHaveBeenLastCalledWith(folded(120));
      pointer(handle, "pointerMove", 280);
      expect(onChange).toHaveBeenLastCalledWith(open(100));
    });

    it("moves nothing after the pointer is released", () => {
      const { onChange, handle } = renderSplitter(open(120));
      pointer(handle, "pointerDown", 300);
      pointer(handle, "pointerUp", 300);
      pointer(handle, "pointerMove", 200);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores a press of any button but the main one", () => {
      const { onChange, handle } = renderSplitter(open(120));
      fireEvent.pointerDown(handle, { clientY: 300, button: 2, pointerId: 1 });
      pointer(handle, "pointerMove", 200);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("opens a folded bar with one pull down, not by following the pointer", () => {
      const { onChange, handle } = renderSplitter(folded(96));
      pointer(handle, "pointerDown", 100);
      pointer(handle, "pointerMove", 100 + PULL_OPEN_DISTANCE - 1);
      expect(onChange).not.toHaveBeenCalled();
      pointer(handle, "pointerMove", 100 + PULL_OPEN_DISTANCE);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(open(96));
      // The pull is over: going on down changes nothing more.
      pointer(handle, "pointerMove", 400);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("leaves a folded bar folded when pulled up", () => {
      const { onChange, handle } = renderSplitter(folded(96));
      pointer(handle, "pointerDown", 100);
      pointer(handle, "pointerMove", 40);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("toggles on a double click", () => {
      const { onChange, handle } = renderSplitter(open(120));
      fireEvent.doubleClick(handle);
      expect(onChange).toHaveBeenCalledWith(folded(120));
    });
  });

  describe("with the keyboard", () => {
    const press = (handle: HTMLElement, key: string) => fireEvent.keyDown(handle, { key });

    it("moves by a step with the arrow keys, down for larger", () => {
      const { onChange, handle } = renderSplitter(open(120));
      press(handle, "ArrowDown");
      expect(onChange).toHaveBeenLastCalledWith(open(120 + KEY_STEP));
      press(handle, "ArrowUp");
      expect(onChange).toHaveBeenLastCalledWith(open(120 - KEY_STEP));
    });

    it("folds from the smallest orb, and opens a folded bar on down", () => {
      const smallest = renderSplitter(open(MIN_ORB));
      press(smallest.handle, "ArrowUp");
      expect(smallest.onChange).toHaveBeenCalledWith(folded(MIN_ORB));
    });

    it("opens a folded bar on down", () => {
      const { onChange, handle } = renderSplitter(folded(100));
      press(handle, "ArrowDown");
      expect(onChange).toHaveBeenCalledWith(open(100));
    });

    it("folds on Home and opens on End", () => {
      const { onChange, handle } = renderSplitter(open(MAX_ORB - 10));
      press(handle, "Home");
      expect(onChange).toHaveBeenLastCalledWith(folded(MAX_ORB - 10));
      press(handle, "End");
      expect(onChange).toHaveBeenLastCalledWith(open(MAX_ORB - 10));
    });

    it.each(["Enter", " "])("toggles on %j", (key) => {
      const { onChange, handle } = renderSplitter(open(120));
      press(handle, key);
      expect(onChange).toHaveBeenCalledWith(folded(120));
    });

    it("leaves other keys alone, so Tab still moves on", () => {
      const { onChange, handle } = renderSplitter(open(120));
      const notPrevented = fireEvent.keyDown(handle, { key: "Tab" });
      expect(notPrevented).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps the page from scrolling on the keys it uses", () => {
      const { handle } = renderSplitter(open(120));
      expect(fireEvent.keyDown(handle, { key: "ArrowDown" })).toBe(false);
    });
  });
});
