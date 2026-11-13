import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyFirms, fetchOwnedFirms, type MyFirm, type OwnedFirm } from "@/lib/advisorApi";

// The console's header link, the page guard and the page itself each need to know which firms the person owns. They share
// one answer per person, kept only for a few seconds so ownership that ended is asked about again, and never a failure.
const KEEP_MS = 5_000;

/** One shared answer per person and sign-in for a question about the person's firms, kept for a few seconds, never a failure. */
function sharedLoad<T>(ask: () => Promise<T[]>) {
  let cached: { userId: string; sessionKey: string; at: number; promise: Promise<T[]> } | null = null;
  return {
    load(userId: string, sessionKey: string): Promise<T[]> {
      if (cached && cached.userId === userId && cached.sessionKey === sessionKey && Date.now() - cached.at < KEEP_MS) return cached.promise;
      const promise = (async () => ask())();
      const entry = { userId, sessionKey, at: Date.now(), promise };
      cached = entry;
      promise.catch(() => {
        if (cached === entry) cached = null;
      });
      return promise;
    },
    clear() {
      cached = null;
    },
  };
}

const owned = sharedLoad<OwnedFirm>(() => fetchOwnedFirms());
const member = sharedLoad<MyFirm>(() => fetchMyFirms());

/**
 * The firms the person currently owns, asked of the database once for everyone who asks within moments of each other.
 * `sessionKey` names the sign-in (its access token): the answer changes when it does, since a password sign-in is told
 * of no firm until the second factor is done, so an answer given before that is never handed out after it.
 */
export function loadOwnedFirms(userId: string, sessionKey = ""): Promise<OwnedFirm[]> {
  return owned.load(userId, sessionKey);
}

/** The firms the person currently belongs to, with their role in each: shared and kept the way loadOwnedFirms is. */
export function loadMyFirms(userId: string, sessionKey = ""): Promise<MyFirm[]> {
  return member.load(userId, sessionKey);
}

/** Forgets the shared answer (a test; a change of sign-in is already a different key). */
export function clearOwnedFirms(): void {
  owned.clear();
}

/** Forgets the shared membership answer (a test). */
export function clearMyFirms(): void {
  member.clear();
}

/** The firms the signed-in person owns: null while unknown, or when it can't be asked. */
export function useOwnedFirms(): OwnedFirm[] | null {
  const { user, session } = useAuth();
  const userId = user?.id ?? "";
  const sessionKey = session?.access_token ?? "";
  const [firms, setFirms] = useState<OwnedFirm[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadOwnedFirms(userId, sessionKey)
      .then((f) => !cancelled && setFirms(f))
      .catch(() => !cancelled && setFirms(null));
    return () => {
      cancelled = true;
    };
  }, [userId, sessionKey]);
  return firms;
}

/** The firms the signed-in person currently belongs to: null while unknown, or when it can't be asked. */
export function useMyFirms(): MyFirm[] | null {
  const { user, session } = useAuth();
  const userId = user?.id ?? "";
  const sessionKey = session?.access_token ?? "";
  const [firms, setFirms] = useState<MyFirm[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadMyFirms(userId, sessionKey)
      .then((f) => !cancelled && setFirms(f))
      .catch(() => !cancelled && setFirms(null));
    return () => {
      cancelled = true;
    };
  }, [userId, sessionKey]);
  return firms;
}
