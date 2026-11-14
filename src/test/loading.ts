import { screen } from "@testing-library/react";
import { expect, vi } from "vitest";

// Helpers the pages' loading tests share (story CRM-S2.1).

/** The statuses that say something: a status container can be on the page, waiting to be filled, with no words yet. */
export const spoken = () => screen.queryAllByRole("status").filter((e) => e.textContent);

/** Every status container on the page, spoken or not. */
export const allStatuses = () => screen.queryAllByRole("status");

/**
 * The page's statuses are live regions: each is on the page before it has anything to say, and none sits inside an element marked busy
 * (a busy region can hold its changes back, so the announcement would never be heard).
 */
export function expectStatusesOutsideBusy() {
  for (const status of allStatuses()) expect(status.closest("[aria-busy=true]")).toBeNull();
}

/**
 * Follows the ten-second timers a page starts, with fake timers on. `expectAllCleared()` after unmount proves none is left running
 * (the query library keeps timers of its own, so this follows only the ten-second ones). Call `restore()` when done.
 */
export function watchSlowTimers() {
  const started: unknown[] = [];
  const cleared = new Set<unknown>();
  const realSet = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
    const id = realSet(fn, ms, ...rest);
    if (ms === 10_000) started.push(id);
    return id;
  }) as typeof setTimeout);
  vi.spyOn(globalThis, "clearTimeout").mockImplementation(((id: never) => { cleared.add(id); realClear(id); }) as typeof clearTimeout);
  return {
    started: () => started.length,
    expectAllCleared() {
      expect(started.length).toBeGreaterThan(0);
      for (const id of started) expect(cleared.has(id)).toBe(true);
    },
    restore: () => vi.restoreAllMocks(),
  };
}
