import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyFirms, fetchOwnedFirms, type MyFirm, type OwnedFirm } from "@/lib/advisorApi";
import { firmAddressFromHost } from "@/lib/firmHost";
import type { MySupportSession } from "@/lib/supportApi";

// The console's header link, the page guard and the page itself each need to know which firms the person owns. They share
// one answer per person, kept only for a few seconds so ownership that ended is asked about again, and never a failure.
const KEEP_MS = 5_000;

/** One shared answer per person and sign-in for a question about the person's firms, kept for a few seconds, never a failure. */
function sharedLoad<T>(ask: (userId: string, sessionKey: string) => Promise<T[]>) {
  let cached: { userId: string; sessionKey: string; at: number; promise: Promise<T[]> } | null = null;
  return {
    load(userId: string, sessionKey: string): Promise<T[]> {
      if (cached && cached.userId === userId && cached.sessionKey === sessionKey && Date.now() - cached.at < KEEP_MS) return cached.promise;
      const promise = (async () => ask(userId, sessionKey))();
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

/** Whether this page is at a firm's address: a support session works nowhere else (the database asks the same of the request). */
const atFirmAddress = () => firmAddressFromHost(window.location.hostname) !== null;

const owned = sharedLoad<OwnedFirm>(() => fetchOwnedFirms());
// A platform admin's open support session for the firm at this address (story CRM-P2.4) is a third answer next to a membership: the
// database says it is held, and the page reads it as a firm whose role is "support". Asked only at a firm's address, once for everyone.
const support = sharedLoad<MySupportSession>(async () => {
  if (!atFirmAddress()) return [];
  // Loaded only here: nothing on the bare domain, where the console's other screens and their tests run, needs the support calls.
  const { fetchMySupportSessionHere } = await import("@/lib/supportApi");
  const session = await fetchMySupportSessionHere();
  return session ? [session] : [];
});
const member = sharedLoad<MyFirm>(async (userId, sessionKey) => {
  const firms = await fetchMyFirms();
  if (!atFirmAddress()) return firms;
  const [session] = await support.load(userId, sessionKey);
  // Nothing is granted until the second step is done: the page is let in to ask for it, and asked again after.
  if (!session?.isOpen || session.secondFactorPending || firms.some((f) => f.firm_id === session.firmId)) return firms;
  const { supportFirm } = await import("@/lib/supportApi");
  return [...firms, supportFirm(session)];
});

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

/** Forgets the shared membership answer (a test, and ending support access, which changes it at once). */
export function clearMyFirms(): void {
  member.clear();
  support.clear();
}

/**
 * The signed-in admin's latest support session for the firm at this address: open, or the one that has just ended (so the page can say
 * the hour is over). Null when there is none, at a bare domain, or when it can't be asked. Shared and kept like the memberships.
 */
export function loadMySupportSession(userId: string, sessionKey = ""): Promise<MySupportSession | null> {
  return support.load(userId, sessionKey).then((rows) => rows[0] ?? null);
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

/** The signed-in admin's latest support session for the firm at this address, or null: undefined while it is being asked. */
export function useMySupportSession(): MySupportSession | null | undefined {
  const { user, session } = useAuth();
  const userId = user?.id ?? "";
  const sessionKey = session?.access_token ?? "";
  const [found, setFound] = useState<MySupportSession | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    loadMySupportSession(userId, sessionKey)
      .then((s) => !cancelled && setFound(s))
      .catch(() => !cancelled && setFound(null));
    return () => {
      cancelled = true;
    };
  }, [userId, sessionKey]);
  return found;
}
