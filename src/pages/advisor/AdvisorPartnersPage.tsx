import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import {
  choiceRule, Field, FormActions, nameRule, SelectInput, useWorkspaceForm, WorkspaceForm, WorkspaceFormProvider,
} from "@/components/workspace/form";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import { funnelRange } from "@/data/funnel";
import { SOURCE_CODE_PATTERN } from "@/data/intakeSource";
import {
  countsByPartner,
  PARTNER_NAME_MAX,
  partnerKindLabel,
  partnerLink,
  REFERRAL_PARTNER_KIND_LABELS,
  REFERRAL_PARTNER_KINDS,
  sourceRows,
  suggestPartnerCode,
} from "@/data/referralPartners";
import {
  addReferralPartner,
  listReferralPartners,
  loadIntakeSources,
  updateReferralPartner,
  type ReferralPartner,
} from "@/lib/advisorApi";

type Counts = Map<string, { started: number; certified: number }>;
type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; partners: ReferralPartner[]; counts: Counts };

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

  useEffect(() => {
    let cancelled = false;
    // Only the first load replaces the page with "Loading…". A refresh keeps the rows on screen, so a row someone is editing survives it (D-49).
    setLoad((shown) => (shown.kind === "ready" ? shown : { kind: "loading" }));
    const { from, to } = funnelRange("30d");
    Promise.all([listReferralPartners(), loadIntakeSources(from, to)])
      .then(([partners, sources]) => !cancelled && setLoad({ kind: "ready", partners, counts: countsByPartner(sourceRows(sources)) }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

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

        <AddPartnerForm onAdded={reload} />

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-16 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading partners…
          </div>
        )}
        {load.kind === "error" && <AdvisorLoadError error={load.error} what="the referral partners" onRetry={reload} />}
        {load.kind === "ready" && (load.partners.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-10 text-center mt-8">
            <p className="font-medium">No referral partners yet.</p>
            <p className="text-sm text-muted-foreground">Add the first one above, then send them their link.</p>
          </div>
        ) : (
          <PartnerTable partners={load.partners} counts={load.counts} onChanged={reload} />
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

const AddPartnerForm = ({ onAdded }: { onAdded: () => void }) => {
  // Until the advisor types a code of their own, it follows the name.
  const [codeTyped, setCodeTyped] = useState(false);
  const api = useWorkspaceForm({
    schema: addSchema,
    defaultValues: { name: "", kind: "", code: "" },
    save: async (v) => {
      const added = await addReferralPartner(v.code, v.name, v.kind);
      toast.success(`Added ${added.name}. Send them ${partnerLink(added.code)}`);
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
        help={code !== "" && codeOk
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

const PartnerTable = ({ partners, counts, onChanged }: { partners: ReferralPartner[]; counts: Counts; onChanged: () => void }) => (
  <div className="overflow-x-auto mt-8">
    <table className="w-full text-sm border-collapse">
      <caption className="sr-only">Referral partners, their links and their intakes in the last 30 days</caption>
      <thead>
        <tr className="text-left text-xs text-muted-foreground border-b border-border">
          <th scope="col" className="py-2 pr-4 font-normal">Partner</th>
          <th scope="col" className="py-2 pr-4 font-normal">Their link</th>
          <th scope="col" className="py-2 pr-4 font-normal text-right whitespace-nowrap">Started, 30 days</th>
          <th scope="col" className="py-2 pr-4 font-normal text-right whitespace-nowrap">Certified, 30 days</th>
          <th scope="col" className="py-2 font-normal"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {partners.map((p) => (
          <PartnerRow key={p.code} partner={p} counts={counts.get(p.code)} onChanged={onChanged} />
        ))}
      </tbody>
    </table>
  </div>
);

const PartnerRow = ({ partner, counts, onChanged }: { partner: ReferralPartner; counts?: { started: number; certified: number }; onChanged: () => void }) => {
  const [editing, setEditing] = useState(false);
  const link = partnerLink(partner.code);
  const api = useWorkspaceForm({
    schema: partnerSchema,
    defaultValues: { name: partner.name, kind: partner.kind },
    save: async (v) => {
      await updateReferralPartner(partner.code, v.name, v.kind);
      toast.success("Partner saved");
    },
    savedValues: (_, v) => v,
    onSaved: () => {
      setEditing(false);
      onChanged();
    },
    failureMessage: "Couldn't save the partner. Check your connection and try again.",
    onCancel: () => setEditing(false),
  });

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
      </td>
      <td className="py-3 pr-4 text-right tabular-nums">{(counts?.started ?? 0).toLocaleString("en-US")}</td>
      <td className="py-3 pr-4 text-right tabular-nums">{(counts?.certified ?? 0).toLocaleString("en-US")}</td>
      <td className="py-3 text-right">
        {editing ? (
          <FormActions className="min-w-44" />
        ) : (
          <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${partner.name}`} className={`${buttonClass} ml-auto`}>
            Edit
          </button>
        )}
      </td>
    </tr>
    </WorkspaceFormProvider>
  );
};

export default AdvisorPartnersPage;
