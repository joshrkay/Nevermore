import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COLUMN_DEFAULT_CSS,
  COLUMN_KEY_STEP,
  COLUMN_KEY_STEP_LARGE,
  COLUMN_MAX_CSS,
  COLUMN_STORAGE_KEY,
  MAX_COLUMN,
  MIN_COLUMN,
  clampColumn,
  defaultColumn,
  forgetColumn,
  maxColumn,
  parseColumnWidth,
  readStoredColumn,
  stepColumn,
  storeColumn,
} from "./columnLayout";

describe("the conversation column's width", () => {
  describe("its limits", () => {
    it("never goes under the narrowest, or over a share of the window, or over the widest", () => {
      expect(clampColumn(50, 1440)).toBe(MIN_COLUMN);
      // On a window under 1200 px the share is what limits it; on a wider one, the widest.
      expect(clampColumn(5000, 1000)).toBe(600);
      expect(clampColumn(5000, 1440)).toBe(MAX_COLUMN);
      expect(clampColumn(400.4, 1440)).toBe(400);
    });

    it("leaves the workspace its room: at most 60% of the window", () => {
      expect(maxColumn(1000)).toBe(600);
      expect(maxColumn(1920)).toBe(MAX_COLUMN);
    });

    it("holds the narrowest even in a window too small to give it 60%", () => {
      expect(maxColumn(300)).toBe(MIN_COLUMN);
    });

    it("matches the stylesheet's own limits, which hold when the window is resized later", () => {
      expect(COLUMN_MAX_CSS).toBe(`min(${MAX_COLUMN}px, 60%)`);
      expect(COLUMN_DEFAULT_CSS).toBe("30%");
    });
  });

  describe("the default", () => {
    it("is 30% of the window, but never narrower than the narrowest column", () => {
      expect(defaultColumn(1440)).toBe(432);
      expect(defaultColumn(800)).toBe(MIN_COLUMN);
    });

    it("is not wider than the widest, on a very wide window", () => {
      expect(defaultColumn(4000)).toBe(MAX_COLUMN);
    });
  });

  describe("with the keyboard", () => {
    it("moves by a step, and by a larger one with Shift", () => {
      expect(stepColumn(400, 1, 1440)).toBe(400 + COLUMN_KEY_STEP);
      expect(stepColumn(400, -1, 1440)).toBe(400 - COLUMN_KEY_STEP);
      expect(stepColumn(400, 1, 1440, true)).toBe(400 + COLUMN_KEY_STEP_LARGE);
    });

    it("stops at the limits", () => {
      expect(stepColumn(MIN_COLUMN, -1, 1440)).toBe(MIN_COLUMN);
      expect(stepColumn(maxColumn(1440), 1, 1440, true)).toBe(maxColumn(1440));
    });
  });
});

describe("what is kept in the browser", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reads back what it wrote, and forgets it on request", () => {
    storeColumn(512);
    expect(localStorage.getItem(COLUMN_STORAGE_KEY)).toBe('{"width":512}');
    expect(readStoredColumn()).toBe(512);
    forgetColumn();
    expect(localStorage.getItem(COLUMN_STORAGE_KEY)).toBeNull();
    expect(readStoredColumn()).toBeNull();
  });

  it.each([
    ["not JSON", "{nope"],
    ["not an object", "42"],
    ["null", "null"],
    ["no width", "{}"],
    ["a string width", '{"width":"wide"}'],
    ["a width that isn't finite", '{"width":null}'],
  ])("ignores a value that is %s", (_name, raw) => {
    expect(parseColumnWidth(raw)).toBeNull();
  });

  it("keeps a width that was chosen on a wider window as it is, to be limited by the window it is used on", () => {
    expect(parseColumnWidth('{"width":700}')).toBe(700);
    expect(clampColumn(700, 1000)).toBe(600);
  });

  it("never reads a width under the narrowest", () => {
    expect(parseColumnWidth('{"width":10}')).toBe(MIN_COLUMN);
  });

  it("copes with a browser that refuses storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => storeColumn(400)).not.toThrow();
    expect(() => forgetColumn()).not.toThrow();
    expect(readStoredColumn()).toBeNull();
  });
});
