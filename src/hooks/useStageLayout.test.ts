import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STAGE_STORAGE_KEY } from "@/data/stageLayout";
import { useStageLayout } from "./useStageLayout";

const originalSize = { width: window.innerWidth, height: window.innerHeight };
const windowOf = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
};
const kept = () => localStorage.getItem(STAGE_STORAGE_KEY);

describe("useStageLayout", () => {
  beforeEach(() => {
    localStorage.clear();
    windowOf(1440, 900);
  });

  afterEach(() => {
    windowOf(originalSize.width, originalSize.height);
    localStorage.clear();
  });

  it("opens on a tall window and keeps nothing until the prospect chooses", () => {
    const { result } = renderHook(() => useStageLayout());
    expect(result.current.layout).toEqual({ collapsed: false, size: 120 });
    expect(kept()).toBeNull();
  });

  it("starts folded on a short window, still keeping nothing, so a taller window later opens it", () => {
    windowOf(1280, 600);
    const { result } = renderHook(() => useStageLayout());
    expect(result.current.layout.collapsed).toBe(true);
    expect(kept()).toBeNull();
  });

  it("goes with what the prospect last chose, whatever the window", () => {
    localStorage.setItem(STAGE_STORAGE_KEY, JSON.stringify({ collapsed: true, size: 90 }));
    const { result } = renderHook(() => useStageLayout());
    expect(result.current.layout).toEqual({ collapsed: true, size: 90 });

    localStorage.setItem(STAGE_STORAGE_KEY, JSON.stringify({ collapsed: false, size: 150 }));
    windowOf(1280, 600);
    expect(renderHook(() => useStageLayout()).result.current.layout).toEqual({ collapsed: false, size: 150 });
  });

  it("falls back to the default when what was kept is not something it wrote", () => {
    localStorage.setItem(STAGE_STORAGE_KEY, "garbage");
    const { result } = renderHook(() => useStageLayout());
    expect(result.current.layout).toEqual({ collapsed: false, size: 120 });
  });

  it("keeps a change, and the next visit starts there", () => {
    const first = renderHook(() => useStageLayout());
    act(() => first.result.current.change({ collapsed: false, size: 100 }));
    expect(JSON.parse(kept()!)).toEqual({ collapsed: false, size: 100 });
    first.unmount();

    expect(renderHook(() => useStageLayout()).result.current.layout).toEqual({ collapsed: false, size: 100 });
  });

  it("folds and unfolds, keeping the size", () => {
    const { result } = renderHook(() => useStageLayout());
    act(() => result.current.change({ collapsed: false, size: 88 }));
    act(() => result.current.collapse());
    expect(result.current.layout).toEqual({ collapsed: true, size: 88 });
    // Folding a folded stage changes nothing.
    act(() => result.current.collapse());
    expect(result.current.layout).toEqual({ collapsed: true, size: 88 });
    act(() => result.current.toggle());
    expect(result.current.layout).toEqual({ collapsed: false, size: 88 });
    expect(JSON.parse(kept()!)).toEqual({ collapsed: false, size: 88 });
  });
});
