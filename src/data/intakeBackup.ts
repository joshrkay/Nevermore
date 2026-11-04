// A copy, in this browser, of intake answers the server hasn't confirmed yet (A-1.4). If a save fails and
// the tab is closed, crashes or reloads, the Chamber offers the copy back the next time the same person
// opens the same intake.
//
// * Written only while something is unsaved, and removed once a save is confirmed, so it is normally
//   empty. Kept for at most BACKUP_MAX_AGE_MS. Signing out removes every backup in this browser.
// * The employee census is never written here: it holds names, dates of birth and pay. A restore keeps
//   the census the server has.
// * Keyed by user and intake, so one person's copy is never offered to someone else on a shared browser.
// * Read back as untrusted input: a copy that isn't the shape written below, or whose answers break the
//   intake schema, is discarded rather than restored.
// * Browser storage can be missing, blocked or full. Every call here then quietly does nothing.

import { validateChamberData } from "./intakeSchema";

export const BACKUP_PREFIX = "eaa.intake-backup.v1:";
export const BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface IntakeBackup {
  userId: string;
  sessionId: string;
  /** The saved version these changes were made on top of; null when it wasn't known. */
  baseVersion: number | null;
  /** When the copy was written (ISO 8601). */
  savedAt: string;
  /** The answers, without the census. */
  chamber_data: Record<string, unknown>;
  field_provenance: Record<string, unknown>;
  transcript: unknown[];
}

const keyFor = (userId: string, sessionId: string) => `${BACKUP_PREFIX}${userId}:${sessionId}`;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Some browsers throw on the property itself when site data is blocked.
    return null;
  }
}

/** Whether this browser will keep anything for the site (it may refuse, or forget on close). */
export function browserStorageWorks(): boolean {
  const store = storage();
  if (!store) return false;
  const probe = `${BACKUP_PREFIX}probe`;
  try {
    store.setItem(probe, "1");
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Keeps the unsaved answers. False when the browser wouldn't store them (blocked, or full). */
export function writeBackup(
  backup: Omit<IntakeBackup, "savedAt" | "chamber_data"> & { chamber_data: Record<string, unknown> },
  now = Date.now(),
): boolean {
  const store = storage();
  if (!store) return false;
  // `employees` is the census's older name; neither is ever written to the browser.
  const { census: _census, employees: _employees, ...answers } = backup.chamber_data;
  const record: IntakeBackup = { ...backup, chamber_data: answers, savedAt: new Date(now).toISOString() };
  try {
    store.setItem(keyFor(backup.userId, backup.sessionId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/** Removes the copy of one intake's unsaved answers. */
export function clearBackup(userId: string, sessionId: string): void {
  try {
    storage()?.removeItem(keyFor(userId, sessionId));
  } catch {
    // Nothing to do: storage is unavailable.
  }
}

/** Why a stored copy isn't usable, or null when it is. */
function backupProblem(value: unknown, userId: string, sessionId: string, now: number): string | null {
  if (!isRecord(value)) return "not an object";
  if (value.userId !== userId || value.sessionId !== sessionId) return "for another person or intake";
  if (value.baseVersion !== null && !Number.isInteger(value.baseVersion)) return "bad base version";
  const savedAt = typeof value.savedAt === "string" ? Date.parse(value.savedAt) : NaN;
  if (Number.isNaN(savedAt)) return "no time";
  if (now - savedAt > BACKUP_MAX_AGE_MS) return "too old";
  if (!isRecord(value.chamber_data) || !isRecord(value.field_provenance) || !Array.isArray(value.transcript)) return "not the shape written";
  const issues = validateChamberData(value.chamber_data);
  if (issues.length > 0) return `answers break the intake schema at ${issues.map((issue) => issue.path).join(", ")}`;
  return null;
}

/** The copy of one intake's unsaved answers, if there is a usable one. An unusable copy is removed. */
export function readBackup(userId: string, sessionId: string, now = Date.now()): IntakeBackup | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(keyFor(userId, sessionId));
  } catch {
    return null;
  }
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  const problem = backupProblem(value, userId, sessionId, now);
  if (problem) {
    console.warn(`Discarded a local copy of unsaved answers: ${problem}`);
    clearBackup(userId, sessionId);
    return null;
  }
  return value as IntakeBackup;
}

function backupKeys(store: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(BACKUP_PREFIX)) keys.push(key);
  }
  return keys;
}

/** Removes every copy in this browser: on sign-out, so the next person at this computer finds none. */
export function clearAllBackups(): void {
  const store = storage();
  if (!store) return;
  try {
    for (const key of backupKeys(store)) store.removeItem(key);
  } catch {
    // Nothing to do: storage is unavailable.
  }
}

/** Removes copies older than BACKUP_MAX_AGE_MS, or unreadable ones, whoever they belong to. */
export function pruneBackups(now = Date.now()): void {
  const store = storage();
  if (!store) return;
  try {
    for (const key of backupKeys(store)) {
      let savedAt = NaN;
      try {
        const value = JSON.parse(store.getItem(key) ?? "null");
        if (isRecord(value) && typeof value.savedAt === "string") savedAt = Date.parse(value.savedAt);
      } catch {
        // Unreadable: removed below.
      }
      if (Number.isNaN(savedAt) || now - savedAt > BACKUP_MAX_AGE_MS) store.removeItem(key);
    }
  } catch {
    // Nothing to do: storage is unavailable.
  }
}
