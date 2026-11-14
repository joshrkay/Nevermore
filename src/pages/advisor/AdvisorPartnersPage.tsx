import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import {
  choiceRule, Field, FormActions, nameRule, SaveRefused, SelectInput, useWorkspaceForm, WorkspaceForm, WorkspaceFormProvider,
} from "@/components/workspace/form";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { funnelRange } from "@/data/funnel";
import { SOURCE_CODE_PATTERN } from "@/data/intakeSource";
import {
  countsByPartner,
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
import { LoadFailed } from "@/components/workspace/states";

type Counts = Map<string, { started: number; certified: number }>;
type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  /** The person belongs to no firm, or the firm at this address isn't one of theirs. */
  | { kind: "no_firm" }
  /** A member of several firms, on the bare domain, has not said which. */
  | { kind: "choose" }
  | { kind: "ready"; firmId: string; partners: ReferralPartner[]; counts: Counts };

const CODE_RULE = "Use only lowercase letters, digits, dots, hyphens or underscores, starting with a letter or digit.";
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
      if (!firm) return atAddress === null && firms.length > 1 ? { kind: "choose" } : { kind: "no_firm" };
      const { from, to } = funnelRange("30d");
      const [partners, sources] = await Promise.all([listReferralPartners(firm.id), loadIntakeSources(from, to, firm.id)]);
      return { kind: "ready", firmId: firm.id, partners, counts: countsByPartner(sourceRows(sources)) };
    })()
      .then((next) => next && !cancelled && setLoad(next))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `scope` is atAddress and firmParam; setParams is stable enough and must not reload
  }, [attempt, atAddress, firmParam]);

  const reload = () => setAttempt((n) => n + 1);

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <h1 className="font-display text-3xl font-bold mb-1">Referral partners</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Each partner shares a link with their own code. Intakes started from it count for them on the{" "}
          <Link to="/advisor/funnel" className="underline underline-offset-2 hover:text-foreground">funnel</Link>. Partners
          see only the counts you send them, never a prospect's answers.
        </p>

        {atAddress === null && firmList.length > 1 && (
          <div className="mb-6">
            <label htmlFor="partners-firm" className="block text-xs text-muted-foreground">Firm</label>
            <select
              id="partners-firm"
              value={firmParam ?? ""}
              onChange={(e) => setParams(e.target.value ? { firm: e.target.value } : {}, { replace: true })}
              className="min-h-11 bg-muted border border-border rounded-md px-3 text-sm"
            >
              {load.kind === "choose" && <option value="">Choose a firm</option>}
              {firmList.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {load.kind === "ready" && <AddPartnerForm key={load.firmId} firmId={load.firmId} onAdded={reload} />}

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-16 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading partners…
          </div>
        )}
        {load.kind === "error" && <LoadFailed error={load.error} what="the referral partners" onRetry={reload} />}
        {load.kind === "no_firm" && <p role="status" className="text-sm">You aren't a member of a firm, so there are no referral partners to show.</p>}
        {load.kind === "ready" && !referralLinksWork(load.firmId) && (
          <p role="note" className="text-sm text-muted-foreground mt-6">
            Referral links come when the firm can take intakes of its own. Until then referral partners and their codes are kept here, and no link is shown.
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

const partnerSchema = z.object({
  name: nameRule("Enter the partner's name.", PARTNER_NAME_MAX),
  kind: choiceRule(REFERRAL_PARTNER_KINDS, "Choose a kind of partner."),
});
const addSchema = partnerSchema.extend({
  code: z.string().min(1, "Enter the code for their link.").regex(SOURCE_CODE_PATTERN, CODE_RULE),
});

/** The database refuses a code that is already a partner's with 23505: that reason belongs to the code field, not to the form. */
const explainAdd = (error: unknown) =>
  (error as { code?: string }).code === "23505" ? { message: (error as Error).message, field: "code" } : undefined;

const KindOptions = ({ chooseOne }: { chooseOne: boolean }) => (
  <>
    {chooseOne && <option value="">Choose one…</option>}
    {REFERRAL_PARTNER_KINDS.map((k) => (
      <option key={k} value={k}>{REFERRAL_PARTNER_KIND_LABELS[k]}</option>
    ))}
  </>
);

const AddPartnerForm = ({ firmId, onAdded }: { firmId: string; onAdded: () => void }) => {
  const links = referralLinksWork(firmId);
  // Until the advisor types a code of their own, it follows the name.
  const [codeTyped, setCodeTyped] = useState(false);
  const api = useWorkspaceForm({
    schema: addSchema,
    defaultValues: { name: "", kind: "", code: "" },
    save: async (v) => {
      const added = await addReferralPartner(firmId, v.code, v.name, v.kind);
      toast.success(links ? `Added ${added.name}. Send them ${partnerLink(added.code)}` : `Added ${added.name}.`);
      return added;
    },
    onSaved: () => {
      setCodeTyped(false);
      onAdded();
    },
    explain: explainAdd,
    failureMessage: "Couldn't add the partner. Check your connection and try again.",
  });
  const code = (api.form.watch("code") as string) ?? "";
  const codeOk = SOURCE_CODE_PATTERN.test(code);

  return (
    <WorkspaceForm api={api} aria-labelledby="add-partner-heading" className="border border-border rounded-xl p-5" actions={<FormActions submitLabel="Add partner" savingLabel="Adding…" />}>
      <h2 id="add-partner-heading" className="font-display text-lg font-bold">Add a partner</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Name" required>
          {(field) => (
            <Input
              {...field}
              maxLength={PARTNER_NAME_MAX}
              onChange={(e) => {
                field.onChange(e);
                if (!codeTyped) api.form.setValue("code", suggestPartnerCode(e.target.value), { shouldValidate: api.form.formState.touchedFields.code === true });
              }}
              placeholder="Acme CFO Partners"
            />
          )}
        </Field>
        <Field name="kind" label="Kind of partner" required>
          {(field) => <SelectInput {...field}><KindOptions chooseOne /></SelectInput>}
        </Field>
      </div>
      <Field
        name="code"
        label="Code in their link"
        required
        help={code !== "" && codeOk && links
          ? `Their link: ${partnerLink(code)}. It can't be changed once the partner is added.`
          : "Lowercase letters, digits, dots, hyphens or underscores. It can't be changed once the partner is added."}
      >
        {(field) => (
          <Input
            {...field}
            maxLength={64}
            className="font-mono"
            onChange={(e) => {
              e.target.value = e.target.value.toLowerCase();
              field.onChange(e);
              setCodeTyped(true);
            }}
          />
        )}
      </Field>
    </WorkspaceForm>
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

type SavedPartner = ReferralPartner;

const PartnerRow = ({ partner: listed, counts, links, onChanged }: { partner: ReferralPartner; counts?: { started: number; certified: number }; links: boolean; onChanged: () => void }) => {
  const [editing, setEditing] = useState(false);
  // What this row's own last save answered, shown (and edited from) at once; the list reload that follows confirms it and takes over.
  const [saved, setSaved] = useState<ReferralPartner | null>(null);
  const partner = saved && saved.version >= listed.version ? saved : listed;
  const link = partnerLink(partner.code);
  const api = useWorkspaceForm({
    schema: partnerSchema,
    defaultValues: { name: partner.name, kind: partner.kind },
    version: partner.version,
    versionOf: (answer: SavedPartner) => answer.version,
    save: async (v, started): Promise<SavedPartner> => {
      // The version the person started editing from, never the row's live one (a reload may have brought a newer one).
      if (started.version === undefined) throw new SaveRefused("Couldn't save the partner. Reload the page and try again.");
      const answer = await updateReferralPartner(partner.firm_id, partner.code, v.name, v.kind, started.version);
      if (!("partner" in answer)) {
        // Nothing was saved. Until the conflict dialog arrives (CRM-S2.4a), say so plainly and keep what was typed.
        throw new SaveRefused("Someone else changed this partner while you were editing. Reload to see their change.");
      }
      toast.success("Partner saved");
      return answer.partner;
    },
    savedValues: (_, v) => v,
    onSaved: (answer) => {
      setSaved(answer);
      setEditing(false);
      onChanged();
    },
    failureMessage: "Couldn't save the partner. Check your connection and try again.",
    onCancel: () => setEditing(false),
  });
  const startEditing = () => {
    api.begin({ name: partner.name, kind: partner.kind }, partner.version);
    setEditing(true);
  };

  return (
    <WorkspaceFormProvider api={api}>
    <tr className="border-b border-border/60 align-top" onKeyDown={api.onKeyDown}>
      <th scope="row" className="py-3 pr-4 font-normal text-left">
        {editing ? (
          <WorkspaceForm api={api} actions={null} aria-label={`Edit ${partner.name}`} className="space-y-2 min-w-48">
            <Field name="name" label="Name" required>
              {/* Focus lands in the first field when "Edit" opens the row, so the keyboard can carry on from there. */}
              {(field) => <Input {...field} maxLength={PARTNER_NAME_MAX} autoFocus />}
            </Field>
            <Field name="kind" label="Kind of partner" required>
              {(field) => <SelectInput {...field}><KindOptions chooseOne={false} /></SelectInput>}
            </Field>
          </WorkspaceForm>
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
          <FormActions className="min-w-44" />
        ) : (
          <button type="button" onClick={startEditing} aria-label={`Edit ${partner.name}`} className={`${buttonClass} ml-auto`}>
            Edit
          </button>
        )}
      </td>
    </tr>
    </WorkspaceFormProvider>
  );
};

export default AdvisorPartnersPage;
