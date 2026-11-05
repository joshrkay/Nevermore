// How wide the prospect makes the conversation's column in The Chamber, which the workspace beside it gives up
// or takes back. Pure rules here; the pointer and keyboard live in ColumnSplitter.
import { clearPref, readPref, writePref } from "@/lib/displayPrefs";

export const COLUMN_STORAGE_KEY = "eaa.chamber.column.v1";

/** The narrowest the column goes: Lenore's buttons and a readable message still fit. */
export const MIN_COLUMN = 280;
/** The widest it goes, and never more than this share of the window, so the workspace always keeps its room. */
export const MAX_COLUMN = 720;
const MAX_COLUMN_SHARE = 0.6;
/** What the column is until the prospect drags it: this share of the window. */
const DEFAULT_COLUMN_SHARE = 0.3;

/** What an arrow key moves the divider by, in pixels; with Shift, the larger step. */
export const COLUMN_KEY_STEP = 16;
export const COLUMN_KEY_STEP_LARGE = 64;

/** The same limits for the page's stylesheet, so a window resized after the prospect chose still holds them. */
export const COLUMN_MAX_CSS = `min(${MAX_COLUMN}px, ${MAX_COLUMN_SHARE * 100}%)`;
export const COLUMN_DEFAULT_CSS = `${DEFAULT_COLUMN_SHARE * 100}%`;

export const maxColumn = (viewportWidth: number) =>
  Math.max(MIN_COLUMN, Math.min(MAX_COLUMN, Math.floor(viewportWidth * MAX_COLUMN_SHARE)));

export const clampColumn = (width: number, viewportWidth: number) =>
  Math.min(maxColumn(viewportWidth), Math.max(MIN_COLUMN, Math.round(width)));

/** How wide the column is before the prospect chooses, which is what the page's own layout gives it. */
export const defaultColumn = (viewportWidth: number) =>
  clampColumn(viewportWidth * DEFAULT_COLUMN_SHARE, viewportWidth);

/** One key press: right widens the column, left narrows it. */
export function stepColumn(current: number, direction: 1 | -1, viewportWidth: number, large = false): number {
  return clampColumn(current + direction * (large ? COLUMN_KEY_STEP_LARGE : COLUMN_KEY_STEP), viewportWidth);
}

/** What was stored, or null when it is missing or not something this code wrote. */
export function parseColumnWidth(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { width } = value as Record<string, unknown>;
    // Brought back into range for this window when it is used, since it may have been kept on a wider one.
    return typeof width === "number" && Number.isFinite(width) ? Math.max(MIN_COLUMN, Math.round(width)) : null;
  } catch {
    return null;
  }
}

export const readStoredColumn = (): number | null => parseColumnWidth(readPref(COLUMN_STORAGE_KEY));
export const storeColumn = (width: number): void => writePref(COLUMN_STORAGE_KEY, JSON.stringify({ width }));
/** Back to the default: nothing is kept. */
export const forgetColumn = (): void => clearPref(COLUMN_STORAGE_KEY);
