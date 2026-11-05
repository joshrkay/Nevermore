// Display preferences kept in this browser, such as how big the prospect made a panel. They are not part of an
// intake and hold nothing about the prospect. Best effort: a browser that blocks or fills its site data just
// opens on the defaults next time, and none of these throw.

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Some browsers throw on the property itself when site data is blocked.
    return null;
  }
}

export function readPref(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Blocked or full.
  }
}

export function clearPref(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Blocked.
  }
}
