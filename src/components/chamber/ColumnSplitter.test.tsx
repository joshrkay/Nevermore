import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ColumnSplitter from "./ColumnSplitter";
import { MIN_COLUMN, COLUMN_KEY_STEP, COLUMN_KEY_STEP_LARGE, maxColumn } from "@/data/columnLayout";

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

const originalWidth = window.innerWidth;
const setWindowWidth = (value: number) => Object.defineProperty(window, "innerWidth", { configurable: true, value });
beforeEach(() => setWindowWidth(1440));
afterEach(() => setWindowWidth(originalWidth));

/**
 * `measured` is the column's width on screen. By default it is what was kept, or, when nothing was chosen, the
 * share of the window the page gives it; it differs from what was kept when the window has shrunk since.
 */
const renderSplitter = (width: number | null, measured: number = width ?? 432) => {
  const onChange = vi.fn();
  const columnRef = createRef<HTMLDivElement>();
  render(
    <>
      <div id="col" ref={columnRef} />
      <ColumnSplitter width={width} onChange={onChange} columnRef={columnRef} controls="col" />
    </>,
  );
  columnRef.current!.getBoundingClientRect = () => ({ width: measured }) as DOMRect;
  return { onChange, handle: screen.getByRole("separator") };
};

const pointer = (handle: HTMLElement, type: "pointerDown" | "pointerMove" | "pointerUp", clientX: number) =>
  fireEvent[type](handle, { clientX, button: 0, pointerId: 1 });

describe("ColumnSplitter", () => {
  it("says how wide the column is, and how wide it can be, to a screen reader", () => {
    const { handle } = renderSplitter(500);
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-label", "Resize the conversation");
    expect(handle).toHaveAttribute("aria-controls", "col");
    expect(handle).toHaveAttribute("aria-valuemin", String(MIN_COLUMN));
    expect(handle).toHaveAttribute("aria-valuemax", String(maxColumn(1440)));
    expect(handle).toHaveAttribute("aria-valuenow", "500");
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("says what is true after the window is resized, not what it was when the page opened", () => {
    const { handle } = renderSplitter(700);
    expect(handle).toHaveAttribute("aria-valuenow", "700");
    expect(handle).toHaveAttribute("aria-valuemax", String(maxColumn(1440)));
    act(() => {
      setWindowWidth(1000);
      window.dispatchEvent(new Event("resize"));
    });
    // The column is capped at 60% of the window now, and the divider says so.
    expect(handle).toHaveAttribute("aria-valuemax", "600");
    expect(handle).toHaveAttribute("aria-valuenow", "600");
  });

  it("reads the default width as what the page gives the column before a choice", () => {
    const { handle } = renderSplitter(null);
    expect(handle).toHaveAttribute("aria-valuenow", "432");
  });

  it("tells the pointer how to use it", () => {
    expect(renderSplitter(null).handle).toHaveAttribute("title", expect.stringMatching(/drag.*double-click/i));
  });

  describe("dragging", () => {
    it("resizes the column as the pointer moves, from the width it had when pressed", () => {
      const { onChange, handle } = renderSplitter(500);
      pointer(handle, "pointerDown", 500);
      pointer(handle, "pointerMove", 560);
      expect(onChange).toHaveBeenLastCalledWith(560);
      pointer(handle, "pointerMove", 420);
      expect(onChange).toHaveBeenLastCalledWith(420);
    });

    it("starts from the width on screen, not the one kept, when the window has shrunk since it was chosen", () => {
      // 700 px was chosen on a wide window; on a 1000 px one the stylesheet shows 600 (60%).
      setWindowWidth(1000);
      const { onChange, handle } = renderSplitter(700, 600);
      pointer(handle, "pointerDown", 600);
      pointer(handle, "pointerMove", 540);
      // From 600 it is 540, and the handle stays under the pointer; from the kept 700 it would be 640, capped to 600.
      expect(onChange).toHaveBeenLastCalledWith(540);
    });

    it("falls back to what was kept when the column measures nothing", () => {
      const { onChange, handle } = renderSplitter(500, 0);
      pointer(handle, "pointerDown", 500);
      pointer(handle, "pointerMove", 530);
      expect(onChange).toHaveBeenLastCalledWith(530);
    });

    it("starts from what the column measures when nothing was chosen, since its default is a share of the window", () => {
      const { onChange, handle } = renderSplitter(null, 432);
      pointer(handle, "pointerDown", 432);
      pointer(handle, "pointerMove", 452);
      expect(onChange).toHaveBeenLastCalledWith(452);
    });

    it("stops at the narrowest and at the widest the window allows", () => {
      const { onChange, handle } = renderSplitter(500);
      pointer(handle, "pointerDown", 500);
      pointer(handle, "pointerMove", -1000);
      expect(onChange).toHaveBeenLastCalledWith(MIN_COLUMN);
      pointer(handle, "pointerMove", 5000);
      expect(onChange).toHaveBeenLastCalledWith(maxColumn(1440));
    });

    it("moves nothing after the pointer is released, or when no press came first", () => {
      const { onChange, handle } = renderSplitter(500);
      pointer(handle, "pointerMove", 600);
      expect(onChange).not.toHaveBeenCalled();
      pointer(handle, "pointerDown", 500);
      pointer(handle, "pointerUp", 500);
      pointer(handle, "pointerMove", 650);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores a press of any button but the main one", () => {
      const { onChange, handle } = renderSplitter(500);
      fireEvent.pointerDown(handle, { clientX: 500, button: 2, pointerId: 1 });
      pointer(handle, "pointerMove", 600);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("goes back to the default on a double click", () => {
      const { onChange, handle } = renderSplitter(600);
      fireEvent.doubleClick(handle);
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe("with the keyboard", () => {
    const press = (handle: HTMLElement, key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(handle, { key, ...init });

    it("moves by a step with the arrow keys, right for wider", () => {
      const { onChange, handle } = renderSplitter(500);
      press(handle, "ArrowRight");
      expect(onChange).toHaveBeenLastCalledWith(500 + COLUMN_KEY_STEP);
      press(handle, "ArrowLeft");
      expect(onChange).toHaveBeenLastCalledWith(500 - COLUMN_KEY_STEP);
    });

    it("moves by a larger step with Shift", () => {
      const { onChange, handle } = renderSplitter(500);
      press(handle, "ArrowRight", { shiftKey: true });
      expect(onChange).toHaveBeenLastCalledWith(500 + COLUMN_KEY_STEP_LARGE);
    });

    it("steps from what the column measures when nothing was chosen", () => {
      const { onChange, handle } = renderSplitter(null, 432);
      press(handle, "ArrowRight");
      expect(onChange).toHaveBeenLastCalledWith(432 + COLUMN_KEY_STEP);
    });

    it("moves the first key press when the window has shrunk, since it steps from the width on screen", () => {
      setWindowWidth(1000);
      const { onChange, handle } = renderSplitter(700, 600);
      press(handle, "ArrowLeft");
      // From the kept 700 the step would be 684, capped to 600: a press that changes nothing the prospect can see.
      expect(onChange).toHaveBeenLastCalledWith(600 - COLUMN_KEY_STEP);
    });

    it("goes to the narrowest on Home and the widest on End", () => {
      const { onChange, handle } = renderSplitter(500);
      press(handle, "Home");
      expect(onChange).toHaveBeenLastCalledWith(MIN_COLUMN);
      press(handle, "End");
      expect(onChange).toHaveBeenLastCalledWith(maxColumn(1440));
    });

    it("goes back to the default on Enter", () => {
      const { onChange, handle } = renderSplitter(500);
      press(handle, "Enter");
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("leaves other keys alone, so Tab still moves on and the page still scrolls", () => {
      const { onChange, handle } = renderSplitter(500);
      expect(fireEvent.keyDown(handle, { key: "Tab" })).toBe(true);
      expect(fireEvent.keyDown(handle, { key: "ArrowDown" })).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
      expect(fireEvent.keyDown(handle, { key: "ArrowRight" })).toBe(false);
    });
  });
});
