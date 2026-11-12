import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { formatDateTime } from "@/components/advisor/format";
import { BROKER_PROVIDER_LABELS, BROKER_PROVIDERS, type BrokerProvider } from "@/data/mailboxScopes";
import {
  addAllowedOrganisation, fetchIsAdmin, loadOrganisationRule, removeAllowedOrganisation,
  type AdvisorRoleEventRow, type AllowedOrganisationRow,
} from "@/lib/advisorApi";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "not_admin" }
  | { kind: "ready"; organisations: AllowedOrganisationRow[]; events: AdvisorRoleEventRow[] };

const input = "w-full min-h-11 bg-muted border border-border rounded-md px-3 text-sm";
const button = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";

const providerLabel = (p: string) => BROKER_PROVIDER_LABELS[p as BrokerProvider] ?? p;

const EVENT_TEXT: Record<string, string> = {
  org_added: "Added to the list",
  org_removed: "Removed from the list",
  role_granted: "Got the advisor role",
};

/**
 * The organisations whose members get the advisor role without an administrator (story M-4.2; docs/adr/0005). Admins only.
 * A person who signs in with Google or Microsoft is matched on what the provider vouches for: Google's verified domain, or
 * the Microsoft tenant ID. The email text is never matched, and a free-mail domain can't be added.
 */
const AdvisorOrganisationsPage = () => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [provider, setProvider] = useState<BrokerProvider>("google");
  const [orgId, setOrgId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<"add" | number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    fetchIsAdmin()
      .then((admin) => (admin ? loadOrganisationRule().then((r): Load => ({ kind: "ready", ...r })) : ({ kind: "not_admin" } as Load)))
      .then((next) => !cancelled && setLoad(next))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("add");
    try {
      await addAllowedOrganisation(provider, orgId.trim(), label.trim());
      toast.success("Added. People who sign in from it get the advisor role.");
      setOrgId("");
      setLabel("");
      setAttempt((n) => n + 1);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(null);
  };

  const remove = async (id: number) => {
    setBusy(id);
    try {
      await removeAllowedOrganisation(id);
      toast.success("Removed. People who already have the role keep it until you revoke it.");
      setConfirming(null);
      setAttempt((n) => n + 1);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8 max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">Allowed organisations</h1>
          <p className="text-sm text-muted-foreground">
            Someone who signs in with Google or Microsoft from one of these gets the advisor role without waiting for you. It is matched on what
            the provider vouches for, never on the email address: Google's verified domain for a Workspace account, or the Microsoft tenant ID.
            Anyone else waits for an administrator. A free-mail domain can't be added. The advisor role shows every submission to its holder, so add
            only an organisation whose members should see them.
          </p>
        </div>
        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-12 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading…
          </div>
        )}
        {load.kind === "error" && <AdvisorLoadError error={load.error} what="the allowed organisations" onRetry={() => setAttempt((n) => n + 1)} />}
        {load.kind === "not_admin" && <p role="status" className="text-sm">Only an admin can change who gets the advisor role.</p>}
        {load.kind === "ready" && (
          <>
            <form onSubmit={add} className="border border-border rounded-xl p-5 space-y-3" aria-label="Add an organisation">
              <h2 className="font-semibold">Add an organisation</h2>
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr_1fr]">
                <div>
                  <label htmlFor="org-provider" className="text-xs text-muted-foreground">Provider</label>
                  <select id="org-provider" value={provider} onChange={(e) => setProvider(e.target.value as BrokerProvider)} className={input}>
                    {BROKER_PROVIDERS.map((p) => <option key={p} value={p}>{BROKER_PROVIDER_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="org-id" className="text-xs text-muted-foreground">{provider === "google" ? "Verified domain" : "Tenant ID"}</label>
                  <input id="org-id" value={orgId} onChange={(e) => setOrgId(e.target.value)} required className={`${input} font-mono`}
                    placeholder={provider === "google" ? "advisory.example" : "00000000-0000-0000-0000-000000000000"} />
                </div>
                <div>
                  <label htmlFor="org-label" className="text-xs text-muted-foreground">Name</label>
                  <input id="org-label" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={80} className={input} placeholder="Edgar Allan Advisory" />
                </div>
              </div>
              <button type="submit" disabled={busy !== null || !orgId.trim() || !label.trim()} className={`${button} bg-primary text-primary-foreground border-primary hover:bg-primary/90`}>
                {busy === "add" ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Adding" /> : "Add"}
              </button>
            </form>

            <section aria-label="The list" className="space-y-3">
              {load.organisations.length === 0 ? (
                <p role="status" className="text-sm text-muted-foreground">No organisation is allowed yet, so everyone who signs up waits for an administrator.</p>
              ) : (
                <ul className="space-y-2">
                  {load.organisations.map((o) => (
                    <li key={o.id} className="border border-border rounded-xl p-4 flex flex-wrap items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-semibold">{providerLabel(o.provider)}</span>
                      <span className="font-medium">{o.label}</span>
                      <span className="font-mono text-xs text-muted-foreground break-all">{o.org_id}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{`Added ${formatDateTime(o.added_at)}${o.added_by_email ? ` by ${o.added_by_email}` : ""}`}</span>
                      {confirming === o.id ? (
                        <span className="flex items-center gap-2 text-sm">
                          Stop matching it?
                          <button onClick={() => remove(o.id)} disabled={busy !== null} className={button}>
                            {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Removing" /> : "Yes, remove"}
                          </button>
                          <button onClick={() => setConfirming(null)} disabled={busy !== null} className={button}>Keep</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirming(o.id)} className={button} aria-label={`Remove ${o.label}`}>Remove</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Recent changes and grants">
              <h2 className="font-semibold mb-2">Recent changes and grants</h2>
              {load.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ol className="space-y-1 text-sm">
                  {load.events.map((ev) => (
                    <li key={ev.id} className="text-muted-foreground">
                      <span className="text-foreground">{ev.actor_email ?? "Someone"}</span>
                      {`: ${EVENT_TEXT[ev.kind] ?? ev.kind}`}
                      {ev.kind === "role_granted" ? ` through ${ev.org_label ?? ev.org_id} (${providerLabel(ev.provider)})` : ` · ${ev.org_label ?? ev.org_id} (${providerLabel(ev.provider)})`}
                      {` · ${formatDateTime(ev.at)}`}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default AdvisorOrganisationsPage;
