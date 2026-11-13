import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchOwnedFirms, type OwnedFirm } from "@/lib/advisorApi";

// The console's header link, the page guard and the page itself each need to know which firms the person owns. They share
// one answer per person, kept only for a few seconds so ownership that ended is asked about again, and never a failure.
const KEEP_MS = 5_000;
let cached: { userId: string; at: number; promise: Promise<OwnedFirm[]> } | null = null;

/** The firms the person currently owns, asked of the database once for everyone who asks within moments of each other. */
export function loadOwnedFirms(userId: string): Promise<OwnedFirm[]> {
  if (cached && cached.userId === userId && Date.now() - cached.at < KEEP_MS) return cached.promise;
  const promise = (async () => fetchOwnedFirms())();
  const entry = { userId, at: Date.now(), promise };
  cached = entry;
  promise.catch(() => {
    if (cached === entry) cached = null;
  });
  return promise;
}

/** Forgets the shared answer (a sign-out, a test). */
export function clearOwnedFirms(): void {
  cached = null;
}

/** The firms the signed-in person owns: null while unknown, or when it can't be asked. */
export function useOwnedFirms(): OwnedFirm[] | null {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [firms, setFirms] = useState<OwnedFirm[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadOwnedFirms(userId)
      .then((f) => !cancelled && setFirms(f))
      .catch(() => !cancelled && setFirms(null));
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return firms;
}
