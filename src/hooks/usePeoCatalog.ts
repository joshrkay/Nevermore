import { useCallback, useEffect, useMemo, useState } from "react";
import { lineOf, type QuoteLine } from "@/data/lines";
import type { PeoRecord } from "@/data/peoCatalog";
import { readPeoCatalog } from "@/lib/peoCatalog";

export type PeoCatalogStatus = "loading" | "ready" | "failed";

/**
 * The PEOs the database lists, read once `enabled` (signed-in readers only: signed out, nobody reads a PEO). None
 * while loading, and none when they can't be read: a prospect can still name a PEO in their own words. `retry` reads
 * them again.
 *
 * The database lists every market (ADR 0029): PEOs, and carriers for workers' comp. This gives the markets of one line: PEOs unless `line` names another, so a
 * screen written for PEOs never offers a carrier, and a workers' comp search asks for carriers by name.
 */
export function usePeoCatalog(enabled = true, line: QuoteLine = "peo"): { peos: PeoRecord[]; status: PeoCatalogStatus; retry: () => void } {
  const [state, setState] = useState<{ peos: PeoRecord[]; status: PeoCatalogStatus }>({ peos: [], status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((current) => (current.status === "loading" ? current : { peos: current.peos, status: "loading" }));
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
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // Read once for every line; the line asked for only chooses among what was read, so asking for another reads nothing again.
  const peos = useMemo(() => state.peos.filter((p) => lineOf(p.line) === line), [state.peos, line]);
  return { peos, status: state.status, retry };
}
