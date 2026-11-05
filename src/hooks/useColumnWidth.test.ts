import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COLUMN_STORAGE_KEY } from "@/data/columnLayout";
import { useColumnWidth } from "./useColumnWidth";

const kept = () => localStorage.getItem(COLUMN_STORAGE_KEY);

describe("useColumnWidth", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("is the default (null) and keeps nothing until the prospect chooses", () => {
    const { result } = renderHook(() => useColumnWidth());
    expect(result.current.width).toBeNull();
    expect(kept()).toBeNull();
  });

  it("goes with the width the prospect last chose", () => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify({ width: 520 }));
    expect(renderHook(() => useColumnWidth()).result.current.width).toBe(520);
  });

  it("falls back to the default when what was kept is not something it wrote", () => {
    localStorage.setItem(COLUMN_STORAGE_KEY, "garbage");
    expect(renderHook(() => useColumnWidth()).result.current.width).toBeNull();
  });

  it("keeps a width, and the next visit starts there", () => {
    const first = renderHook(() => useColumnWidth());
    act(() => first.result.current.change(480));
    expect(JSON.parse(kept()!)).toEqual({ width: 480 });
    first.unmount();
    expect(renderHook(() => useColumnWidth()).result.current.width).toBe(480);
  });

  it("forgets the width when sent back to the default, so the column follows the window again", () => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify({ width: 480 }));
    const { result } = renderHook(() => useColumnWidth());
    act(() => result.current.change(null));
    expect(result.current.width).toBeNull();
    expect(kept()).toBeNull();
  });
});
