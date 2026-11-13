import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AdvisorHeader from "@/components/advisor/AdvisorHeader";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { funnelRange } from "@/data/funnel";
import { SOURCE_CODE_PATTERN } from "@/data/intakeSource";
import {
  countsByPartner,
  isReferralPartnerKind,
  PARTNER_NAME_MAX,
  partnerKindLabel,
  partnerKey,
  partnerLink,
  referralLinksWork,
  REFERRAL_PARTNER_KIND_LABELS,
  REFERRAL_PARTNER_KINDS,
  sourceRows,
  suggestPartnerCode,
} from "@/data/referralPartners";
import {
  addReferralPartner,
  listMyFirms,
  listReferralPartners,
  loadIntakeSources,
  updateReferralPartner,
  type MemberFirm,
  type ReferralPartner,
} from "@/lib/advisorApi";

type Counts = Map<string, { started: number; certified: number }>;
type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  /** The person belongs to no firm, or the firm at this address isn't one of theirs. */
  | { kind: "no_firm" }
  /** A member of several firms, on the bare domain, has not said which. */
  | { kind: "choose"; firms: MemberFirm[] }
  | { kind: "ready"; firms: MemberFirm[]; firmId: string; partners: ReferralPartner[]; counts: Counts };

const inputClass = "w-full bg-muted border border-border rounded-md px-3 py-2 text-sm";
const buttonClass = "flex items-center gap-2 border border-border text-sm px-3 py-1.5 rounded-md hover:bg-muted disabled:opacity-50";

async function copyLink(link: string) {
  try {
    await navigator.clipboard.writeText(link);
    toast.success("Link copied");
  } catch {
    toast.error("Couldn't copy the link. Select it and copy it instead.");
  }
}

/**
 * The people and firms who refer employers, each with the link they share. An intake started from a partner's link
 * counts for them on the funnel (migration 20261106100000). Advisors add and rename partners here; a partner's code
 * never changes, because links carrying it are already out.
 */
const AdvisorPartnersPage = () => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [params, setParams] = useSearchParams();
  const firmParam = params.get("firm");
  // At a firm's address the page is that firm's. On the bare domain a member of one firm needs to say nothing and a member of
  // several is asked (?firm=<id>, as the activity page does); the database never guesses a firm for them.
  const address = useFirmAddress();
  const atAddress = address.status === "known" ? address.address : null;

  // The firms the person belongs to, kept apart from what is loaded for one of them so that the chooser stays put while a firm loads.
  const [firmList, setFirmList] = useState<MemberFirm[]>([]);
  // Which firm the page was last asked for: a reload of the same one (after an edit) keeps the table on screen, but another firm
  // never shows the previous one's table or controls while it loads, since a click there would change the wrong firm.
  const loadedScope = useRef<string | null>(null);
  const scope = `${atAddress ?? ""}|${firmParam ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    const sameFirm = loadedScope.current === scope;
    loadedScope.current = scope;
    setLoad((prev) => (prev.kind === "ready" && sameFirm ? prev : { kind: "loading" }));
    (async (): Promise<Load | null> => {
      const firms = await listMyFirms();
      if (!cancelled) setFirmList(firms);
      let firm: MemberFirm | undefined;
      if (atAddress !== null) firm = firms.find((f) => f.address === atAddress);
      else if (firmParam !== null) firm = firms.find((f) => f.id === firmParam);
      // A person with exactly one firm needs to say nothing, so a ?firm= that is none of theirs counts as absent: their firm's id
      // replaces it in the address (which loads the page again, now matched).
      if (!firm && atAddress === null && firms.length === 1) {
        if (firmParam !== null) {
          if (!cancelled) setParams({ firm: firms[0].id }, { replace: true });
          return null;
        }
        firm = firms[0];
      }
      if (!firm) return atAddress === null && firms.length > 1 ? { kind: "choose", firms } : { kind: "no_firm" };
      const { from, to } = funnelRange("30d");
      const [partners, sources] = await Promise.all([listReferralPartners(firm.id), loadIntakeSources(from, to, firm.id)]);
      return { kind: "ready", firms, firmId: firm.id, partners, counts: countsByPartner(sourceRows(sources)) };
    })()
      .then((next) => next && !cancelled && setLoad(next))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `scope` is atAddress and firmParam; setParams is stable enough and must not reload
  }, [attempt, atAddress, firmParam]);

  const reload = () => setAttempt((n) => n + 1);
  const firms = firmList;

  return (
    <div className="min-h-screen bg-background">
      <AdvisorHeader />
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <h1 className="font-display text-3xl font-bold mb-1">Referral partners</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Each partner shares a link with their own code. Intakes started from it count for them on the{" "}
          <Link to="/advisor/funnel" className="underline underline-offset-2 hover:text-foreground">funnel</Link>. Partners
          see only the counts you send them, never a prospect's answers.
        </p>

        {atAddress === null && firms.length > 1 && (
          <div className="mb-6">
            <label htmlFor="partners-firm" className="block text-xs text-muted-foreground">Firm</label>
            <select
              id="partners-firm"
              value={firmParam ?? ""}
              onChange={(e) => setParams(e.target.value ? { firm: e.target.value } : {}, { replace: true })}
              className="min-h-11 bg-muted border border-border rounded-md px-3 text-sm"
            >
              {load.kind === "choose" && <option value="">Choose a firm</option>}
              {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {load.kind === "ready" && <AddPartnerForm key={load.firmId} firmId={load.firmId} onAdded={reload} />}

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-16 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading partners…
          </div>
        )}
        {load.kind === "error" && <AdvisorLoadError error={load.error} what="the referral partners" onRetry={reload} />}
        {load.kind === "no_firm" && <p role="status" className="text-sm">You aren't a member of a firm, so there are no referral partners to show.</p>}
        {load.kind === "ready" && !referralLinksWork(load.firmId) && (
          <p role="note" className="text-sm text-muted-foreground mt-6">
            Referral links come when the firm can take intakes of its own. Until then partners and their codes are kept here, and no link is shown.
          </p>
        )}
        {load.kind === "ready" && (load.partners.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-10 text-center mt-8">
            <p className="font-medium">No referral partners yet.</p>
            <p className="text-sm text-muted-foreground">
              {referralLinksWork(load.firmId) ? "Add the first one above, then send them their link." : "Add the first one above."}
            </p>
          </div>
        ) : (
          <PartnerTable partners={load.partners} counts={load.counts} links={referralLinksWork(load.firmId)} onChanged={reload} />
        ))}
      </main>
    </div>
  );
};

const AddPartnerForm = ({ firmId, onAdded }: { firmId: string; onAdded: () => void }) => {
  const links = referralLinksWork(firmId);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [code, setCode] = useState("");
  // Until the advisor types a code of their own, it follows the name.
  const [codeTyped, setCodeTyped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeOk = SOURCE_CODE_PATTERN.test(code);
  const ready = name.trim() !== "" && isReferralPartnerKind(kind) && codeOk;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      const added = await addReferralPartner(firmId, code, name, kind);
      toast.success(links ? `Added ${added.name}. Send them ${partnerLink(added.code)}` : `Added ${added.name}.`);
      setName("");
      setKind("");
      setCode("");
      setCodeTyped(false);
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby="add-partner-heading" className="border border-border rounded-xl p-5 space-y-4">
      <h2 id="add-partner-heading" className="font-display text-lg font-bold">Add a partner</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="partner-name" className="text-sm font-medium">Name</label>
          <input
            id="partner-name"
            value={name}
            maxLength={PARTNER_NAME_MAX}
            onChange={(e) => {
              setName(e.target.value);
              if (!codeTyped) setCode(suggestPartnerCode(e.target.value));
            }}
            placeholder="Acme CFO Partners"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="partner-kind" className="text-sm font-medium">Kind of partner</label>
          <select id="partner-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
            <option value="">Choose one…</option>
            {REFERRAL_PARTNER_KINDS.map((k) => (
              <option key={k} value={k}>{REFERRAL_PARTNER_KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="partner-code" className="text-sm font-medium">Code in their link</label>
        <input
          id="partner-code"
          value={code}
          maxLength={64}
          onChange={(e) => {
            setCode(e.target.value.toLowerCase());
            setCodeTyped(true);
          }}
          aria-describedby="partner-code-help"
          className={`${inputClass} font-mono`}
        />
        <p id="partner-code-help" className="text-xs text-muted-foreground">
          {code === "" || codeOk
            ? code === "" || !links
              ? "Lowercase letters, digits, dots, hyphens or underscores. It can't be changed once the partner is added."
              : `Their link: ${partnerLink(code)}. It can't be changed once the partner is added.`
            : "Use only lowercase letters, digits, dots, hyphens or underscores, starting with a letter or digit."}
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={!ready || saving} className={buttonClass}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Add partner
      </button>
    </form>
  );
};

const PartnerTable = ({ partners, counts, links, onChanged }: { partners: ReferralPartner[]; counts: Counts; links: boolean; onChanged: () => void }) => (
  <div className="overflow-x-auto mt-8">
    <table className="w-full text-sm border-collapse">
      <caption className="sr-only">{links ? "Referral partners, their links and their intakes in the last 30 days" : "Referral partners, their codes and their intakes in the last 30 days"}</caption>
      <thead>
        <tr className="text-left text-xs text-muted-foreground border-b border-border">
          <th scope="col" className="py-2 pr-4 font-normal">Partner</th>
          <th scope="col" className="py-2 pr-4 font-normal">{links ? "Their link" : "Their code"}</th>
          <th scope="col" className="py-2 pr-4 font-normal text-right whitespace-nowrap">Started, 30 days</th>
          <th scope="col" className="py-2 pr-4 font-normal text-right whitespace-nowrap">Certified, 30 days</th>
          <th scope="col" className="py-2 font-normal"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {partners.map((p) => (
          <PartnerRow key={partnerKey(p.firm_id, p.code)} partner={p} counts={counts.get(partnerKey(p.firm_id, p.code))} links={links} onChanged={onChanged} />
        ))}
      </tbody>
    </table>
  </div>
);

const PartnerRow = ({ partner, counts, links, onChanged }: { partner: ReferralPartner; counts?: { started: number; certified: number }; links: boolean; onChanged: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(partner.name);
  const [kind, setKind] = useState(partner.kind);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = partnerLink(partner.code);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateReferralPartner(partner.firm_id, partner.code, name, kind);
      toast.success("Partner saved");
      setEditing(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-border/60 align-top">
      <th scope="row" className="py-3 pr-4 font-normal text-left">
        {editing ? (
          <div className="space-y-2 min-w-48">
            <label htmlFor={`name-${partner.code}`} className="sr-only">Name</label>
            <input id={`name-${partner.code}`} value={name} maxLength={PARTNER_NAME_MAX} onChange={(e) => setName(e.target.value)} className={inputClass} />
            <label htmlFor={`kind-${partner.code}`} className="sr-only">Kind of partner</label>
            <select id={`kind-${partner.code}`} value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
              {REFERRAL_PARTNER_KINDS.map((k) => (
                <option key={k} value={k}>{REFERRAL_PARTNER_KIND_LABELS[k]}</option>
              ))}
            </select>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <>
            <span className="block font-medium">{partner.name}</span>
            <span className="block text-xs text-muted-foreground">{partnerKindLabel(partner.kind)}</span>
          </>
        )}
      </th>
      <td className="py-3 pr-4">
        {links ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs break-all">{link}</span>
            <button
              type="button"
              onClick={() => void copyLink(link)}
              aria-label={`Copy ${partner.name}'s link`}
              className="shrink-0 p-1.5 rounded-md border border-border hover:bg-muted"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span className="font-mono text-xs break-all">{partner.code}</span>
        )}
      </td>
      <td className="py-3 pr-4 text-right tabular-nums">{(counts?.started ?? 0).toLocaleString("en-US")}</td>
      <td className="py-3 pr-4 text-right tabular-nums">{(counts?.certified ?? 0).toLocaleString("en-US")}</td>
      <td className="py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => void save()} disabled={saving || name.trim() === ""} className={buttonClass}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(partner.name);
                setKind(partner.kind);
                setError(null);
              }}
              className={buttonClass}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${partner.name}`} className={`${buttonClass} ml-auto`}>
            Edit
          </button>
        )}
      </td>
    </tr>
  );
};

export default AdvisorPartnersPage;
