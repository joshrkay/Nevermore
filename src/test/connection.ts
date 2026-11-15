import { act } from "@testing-library/react";
import { vi, type MockInstance } from "vitest";

// What the pages' offline tests share (CRM-S2.4a): the browser's word that the connection went or came back. Call `restoreConnection()` after each test
// (not `vi.restoreAllMocks()`, which would also wipe the page's own mocked calls).
let onLine: MockInstance<() => boolean> | undefined;
const set = (value: boolean) => {
  onLine ??= vi.spyOn(window.navigator, "onLine", "get");
  onLine.mockReturnValue(value);
};

/** The browser reports no connection, and says so with its `offline` event. */
export const goOffline = () => act(() => { set(false); window.dispatchEvent(new Event("offline")); });

/** The browser reports a connection again, and says so with its `online` event. */
export const goOnline = () => act(() => { set(true); window.dispatchEvent(new Event("online")); });

/** Puts the browser's own `navigator.onLine` back. */
export const restoreConnection = () => { onLine?.mockRestore(); onLine = undefined; };
