// How much of the top of The Chamber Lenore's orb takes (the stage), and the rules for changing it. The orb is
// a hero for a prospect who talks, and dead weight for one who types, so the prospect can drag it smaller or
// fold it into a slim bar. Pure rules here; the pointer and keyboard live in StageSplitter.
import { readPref, writePref } from "@/lib/displayPrefs";

/** The prospect's own choice, kept per browser. It is a display preference, not part of an intake. */
export interface StageLayout {
  /** Folded into the slim bar. The orb's size is kept, so opening it again gives back what they had. */
  collapsed: boolean;
  /** The orb's diameter in pixels while the stage is open. The stage grows and shrinks with it, pixel for pixel. */
  size: number;
}

export const STAGE_STORAGE_KEY = "eaa.chamber.stage.v1";

/** Smallest and largest orb the open stage shows. */
export const MIN_ORB = 72;
export const MAX_ORB = 176;
/** Dragging the orb below this folds the stage away. Between this and MIN_ORB the handle holds still, so a
 * fold is a deliberate pull and not a slip. */
export const COLLAPSE_BELOW = 56;
/** What an arrow key moves the handle by, in pixels. */
export const KEY_STEP = 16;
/** How far down a drag from the folded bar must go before the stage opens. */
export const PULL_OPEN_DISTANCE = 12;

const DEFAULT_ORB = 120;
const DEFAULT_ORB_PHONE = 96;
const PHONE_WIDTH = 768;
/** A window shorter than this starts folded: an open stage would take half of it. */
const SHORT_WINDOW = 700;

export const clampOrb = (size: number) => Math.min(MAX_ORB, Math.max(MIN_ORB, Math.round(size)));

/** What was stored, or null when it is missing or not something this code wrote. */
export function parseStageLayout(raw: string | null): StageLayout | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { collapsed, size } = value as Record<string, unknown>;
    if (typeof collapsed !== "boolean" || typeof size !== "number" || !Number.isFinite(size)) return null;
    return { collapsed, size: clampOrb(size) };
  } catch {
    return null;
  }
}

/** What a first visit shows: the stage open, unless the window is too short to spare the room. */
export function defaultStageLayout(viewport: { width: number; height: number }): StageLayout {
  return {
    collapsed: viewport.height < SHORT_WINDOW,
    size: viewport.width < PHONE_WIDTH ? DEFAULT_ORB_PHONE : DEFAULT_ORB,
  };
}

/** Where the stage is while a drag that began on an open stage is `delta` pixels from where it started. */
export function dragStage(start: StageLayout, delta: number): StageLayout {
  const wanted = start.size + delta;
  if (wanted < COLLAPSE_BELOW) return { collapsed: true, size: start.size };
  return { collapsed: false, size: clampOrb(wanted) };
}

/** One arrow-key step: down opens and grows, up shrinks and, past the smallest orb, folds. */
export function stepStage(layout: StageLayout, direction: 1 | -1): StageLayout {
  if (layout.collapsed) return direction > 0 ? { ...layout, collapsed: false } : layout;
  const wanted = layout.size + direction * KEY_STEP;
  return wanted < MIN_ORB ? { ...layout, collapsed: true } : { ...layout, size: clampOrb(wanted) };
}

export const toggleStage = (layout: StageLayout): StageLayout => ({ ...layout, collapsed: !layout.collapsed });

export function readStoredStage(): StageLayout | null {
  return parseStageLayout(readPref(STAGE_STORAGE_KEY));
}

/** Best effort: a browser that won't keep it just opens on the default next time. */
export function storeStage(layout: StageLayout): void {
  writePref(STAGE_STORAGE_KEY, JSON.stringify(layout));
}
