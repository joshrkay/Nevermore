import { useEffect, useState } from "react";
import type { PeoRecord } from "@/data/peoCatalog";
import { readPeoCatalog } from "@/lib/peoCatalog";

export type PeoCatalogStatus = "loading" | "ready" | "failed";

/**
 * The PEOs the database lists, read once `enabled` (signed-in readers only: signed out, nobody reads a PEO). None
 * while loading, and none when they can't be read: a prospect can still name a PEO in their own words.
 */
export function usePeoCatalog(enabled = true): { peos: PeoRecord[]; status: PeoCatalogStatus } {
  const [state, setState] = useState<{ peos: PeoRecord[]; status: PeoCatalogStatus }>({ peos: [], status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    readPeoCatalog()
      .then((peos) => {
        if (!cancelled) setState({ peos, status: "ready" });
      })
      .catch((err) => {
        console.warn("Couldn't read the PEOs:", err);
        if (!cancelled) setState({ peos: [], status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
