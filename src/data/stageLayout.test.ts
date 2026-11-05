import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COLLAPSE_BELOW,
  KEY_STEP,
  MAX_ORB,
  MIN_ORB,
  STAGE_STORAGE_KEY,
  clampOrb,
  defaultStageLayout,
  dragStage,
  parseStageLayout,
  readStoredStage,
  stepStage,
  storeStage,
  toggleStage,
  type StageLayout,
} from "./stageLayout";

const open = (size: number): StageLayout => ({ collapsed: false, size });
const folded = (size: number): StageLayout => ({ collapsed: true, size });

describe("the stage's size", () => {
  it("keeps the orb between the smallest and largest it can be", () => {
    expect(clampOrb(10)).toBe(MIN_ORB);
    expect(clampOrb(10_000)).toBe(MAX_ORB);
    expect(clampOrb(100.4)).toBe(100);
  });

  describe("on a first visit", () => {
    it("opens on a laptop or desktop window", () => {
      expect(defaultStageLayout({ width: 1440, height: 900 })).toEqual(open(120));
    });

    it("opens a little smaller on a phone", () => {
      const layout = defaultStageLayout({ width: 390, height: 844 });
      expect(layout.collapsed).toBe(false);
      expect(layout.size).toBeLessThan(120);
    });

    it("starts folded in a window too short to spare the room, keeping the size it would open to", () => {
      expect(defaultStageLayout({ width: 1280, height: 600 })).toEqual(folded(120));
    });
  });

  describe("dragging an open stage", () => {
    it("follows the pointer pixel for pixel", () => {
      expect(dragStage(open(120), 30)).toEqual(open(150));
      expect(dragStage(open(120), -30)).toEqual(open(90));
    });

    it("stops at the largest orb, and holds still at the smallest before it folds", () => {
      expect(dragStage(open(120), 1000)).toEqual(open(MAX_ORB));
      expect(dragStage(open(120), -(120 - MIN_ORB))).toEqual(open(MIN_ORB));
      // Between the smallest orb and the fold point the handle doesn't move: right at the fold point it is
      // still open, at the smallest size.
      expect(dragStage(open(120), COLLAPSE_BELOW - 120)).toEqual(open(MIN_ORB));
    });

    it("folds when pulled past the fold point, remembering the size it had", () => {
      expect(dragStage(open(120), COLLAPSE_BELOW - 120 - 1)).toEqual(folded(120));
      expect(dragStage(open(120), -500)).toEqual(folded(120));
    });

    it("measures from where the drag began, so pulling back opens it again at the same place", () => {
      const start = open(120);
      expect(dragStage(start, -500).collapsed).toBe(true);
      expect(dragStage(start, -30)).toEqual(open(90));
    });
  });

  describe("with the keyboard", () => {
    it("opens a folded stage on down and leaves it be on up", () => {
      expect(stepStage(folded(100), 1)).toEqual(open(100));
      expect(stepStage(folded(100), -1)).toEqual(folded(100));
    });

    it("moves an open one by a step, and folds when it would go smaller than the smallest orb", () => {
      expect(stepStage(open(120), 1)).toEqual(open(120 + KEY_STEP));
      expect(stepStage(open(120), -1)).toEqual(open(120 - KEY_STEP));
      expect(stepStage(open(MIN_ORB), -1)).toEqual(folded(MIN_ORB));
      expect(stepStage(open(MAX_ORB), 1)).toEqual(open(MAX_ORB));
    });
  });

  it("toggles between open and folded without losing the size", () => {
    expect(toggleStage(open(88))).toEqual(folded(88));
    expect(toggleStage(folded(88))).toEqual(open(88));
  });
});

describe("what is kept in the browser", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reads back what it wrote", () => {
    storeStage(folded(96));
    expect(localStorage.getItem(STAGE_STORAGE_KEY)).toBe('{"collapsed":true,"size":96}');
    expect(readStoredStage()).toEqual(folded(96));
  });

  it("is null when nothing was kept", () => {
    expect(readStoredStage()).toBeNull();
  });

  it.each([
    ["not JSON", "{nope"],
    ["not an object", "42"],
    ["null", "null"],
    ["missing fields", "{}"],
    ["a string size", '{"collapsed":false,"size":"big"}'],
    ["a string flag", '{"collapsed":"yes","size":100}'],
    ["a size that isn't finite", '{"collapsed":false,"size":null}'],
  ])("ignores a value that is %s", (_name, raw) => {
    expect(parseStageLayout(raw)).toBeNull();
  });

  it("brings a size from an older or edited value back into range", () => {
    expect(parseStageLayout('{"collapsed":false,"size":9999}')).toEqual(open(MAX_ORB));
    expect(parseStageLayout('{"collapsed":true,"size":1}')).toEqual(folded(MIN_ORB));
  });

  it("copes with a browser that refuses storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => storeStage(open(100))).not.toThrow();
    expect(readStoredStage()).toBeNull();
  });
});
