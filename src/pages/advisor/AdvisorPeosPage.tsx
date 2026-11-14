import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import PeoPanel from "@/components/advisor/peos/PeoPanel";
import { peoStatusLine } from "@/data/peoEditor";
import { localToday } from "@/data/peoProfiles";
import { fetchHasPlatformRole, fetchIsAdmin, loadPeoCatalogDirectory, loadPeoDirectory, type PeoDirectoryEntry } from "@/lib/advisorApi";
import AddPeoForm from "@/components/advisor/peos/AddPeoForm";
import { LoadFailed } from "@/components/workspace/states";

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; peos: PeoDirectoryEntry[]; isAdmin: boolean; catalogue: boolean };

/**
 * The PEOs and their requirement profiles (L-1.2, docs/adr/0010). A member of a firm with no platform role reads the version in
 * use of each PEO, from the catalogue (P-1.4); the rest of this applies to the platform roles. Every advisor reads each PEO's profile in use,
 * where and when each part was checked, and its history. Admins also add PEOs, edit a profile section by section into
 * a draft, review and publish it, record a re-check, and take a PEO off the list or put it back. The database refuses
 * every write from anyone else.
 */
const AdvisorPeosPage = () => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [params, setParams] = useSearchParams();
  const today = localToday();

  useEffect(() => {
    let cancelled = false;
    // A reload after a save keeps the page as it is until the new data is in, so nothing jumps.
    setLoad((current) => (current.kind === "ready" ? current : { kind: "loading" }));
    // A platform role reads the platform's directory (versions, drafts, contacts) and an admin edits it. A member of a firm
    // without one reads the prospect-safe catalogue, the version in use of each PEO, which the tables refuse them (ADR 0010).
    (async () => {
      const [hasRole, isAdmin] = await Promise.all([fetchHasPlatformRole(), fetchIsAdmin()]);
      return [hasRole ? await loadPeoDirectory() : await loadPeoCatalogDirectory(), isAdmin, !hasRole] as const;
    })()
      .then(([peos, isAdmin, catalogue]) => !cancelled && setLoad({ kind: "ready", peos, isAdmin, catalogue }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = () => setAttempt((n) => n + 1);
  const select = (id: number) => setParams({ peo: String(id) });

  const selected = load.kind === "ready" ? load.peos.find((p) => String(p.id) === params.get("peo")) ?? load.peos[0] : undefined;

  return (
    <div className="bg-background">
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl">
        <h1 className="font-display text-3xl font-bold mb-1">PEOs</h1>
        <p className="text-sm text-muted-foreground mb-6">
          What each PEO asks for, where each part was checked and when. PEO Match, the packet's eligibility checks and the
          quote requests read the version in use. A profile not checked in 180 days is marked out of date everywhere it is
          used, and still used.
        </p>

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-16 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading the PEOs…
          </div>
        )}
        {load.kind === "error" && <LoadFailed error={load.error} what="the PEOs" onRetry={reload} />}
        {load.kind === "ready" && (
          <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
            <div className="space-y-4 min-w-0">
              {load.isAdmin && <AddPeoForm onAdded={(id) => { select(id); reload(); }} />}
              {load.peos.length === 0 ? (
                <p className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-6">No PEOs yet.</p>
              ) : (
                <nav aria-label="Choose a PEO">
                  <ul aria-label="PEOs" className="border border-border rounded-xl divide-y divide-border">
                    {load.peos.map((p) => {
                      // Only admins read drafts (row security), so only they see "draft in progress".
                      const line = peoStatusLine(p, today);
                      return (
                        <li key={p.id}>
                          <Link
                            to={`?peo=${p.id}`}
                            aria-current={p === selected ? "page" : undefined}
                            className={`block px-4 py-3 min-h-11 hover:bg-muted ${p === selected ? "bg-muted" : ""}`}
                          >
                            <span className="block font-medium">{p.name}</span>
                            <span className={`block text-xs ${line.includes("out of date") ? "text-warning" : "text-muted-foreground"}`}>
                              {line.includes("out of date") && <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" aria-hidden="true" />}
                              {line}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              )}
            </div>
            {selected && <PeoPanel key={selected.id} peo={selected} isAdmin={load.isAdmin} showContacts={!load.catalogue} today={today} onChanged={reload} />}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdvisorPeosPage;
