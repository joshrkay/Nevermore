import { useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { choiceRule, Field, FormActions, nameRule, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { NothingYet } from "@/components/workspace/states";
import { formatDateTime } from "@/components/advisor/format";
import { BROKER_PROVIDER_LABELS, BROKER_PROVIDERS, type BrokerProvider } from "@/data/mailboxScopes";
import {
  addOrganisation, approveJoinRequest, declineJoinRequest, fetchJoinRequests, fetchOrganisations, removeOrganisation,
  type JoinRequest, type JoinRole, type ListedOrganisation,
} from "@/lib/joinByOrganisationApi";

// The two sections of the Invitations page that are about people coming in by their organisation (story CRM-P1.4): the firm's listed
// Google domains and Microsoft tenants, and the people who asked to join from one. The database decides who may do any of it (a
// current owner of the firm, D-18), what can be listed (never a free-mail domain) and what each person's sign-in vouches for. Lists are
// fetched through the query library: refreshed on focus and every 60 seconds, keeping the rows on screen while the next arrive (D-49).

const button = "min-h-11 px-4 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";
const ROLE_LABELS: Record<JoinRole, string> = { agent: "Agent", lead: "Lead", owner: "Owner" };
const WITH_ARTICLE: Record<JoinRole, string> = { agent: "an agent", lead: "a lead", owner: "an owner" };
const ROLES: readonly JoinRole[] = ["agent", "lead", "owner"];
const providerLabel = (p: string) => BROKER_PROVIDER_LABELS[p as BrokerProvider] ?? p;

const live = { refetchInterval: 60_000, refetchOnWindowFocus: true, placeholderData: keepPreviousData } as const;

const listSchema = z.object({
  provider: choiceRule(BROKER_PROVIDERS, "Choose Google or Microsoft."),
  orgId: nameRule("Enter the Google domain or the Microsoft tenant ID.", 253),
  label: nameRule("Enter a name for the organisation.", 80),
});

const OrganisationForm = ({ firmId, onListed }: { firmId: string; onListed: () => Promise<unknown> }) => {
  const api = useWorkspaceForm({
    schema: listSchema,
    defaultValues: { provider: "google", orgId: "", label: "" },
    save: (v) => addOrganisation({ firmId, provider: v.provider as BrokerProvider, orgId: v.orgId, label: v.label }),
    // Back to the same provider, so listing two Microsoft tenants in a row does not flip the form to Google.
    savedValues: (_r, v) => ({ provider: v.provider, orgId: "", label: "" }),
    onSaved: () => {
      toast.success("Listed. People who sign in from it at your firm's address will show here as asking to join.");
      void onListed();
    },
    failureMessage: "Couldn't list the organisation. Check your connection and try again.",
  });
  const provider = api.form.watch("provider") as BrokerProvider;
  return (
    <WorkspaceForm api={api} aria-label="List an organisation" className="border border-border rounded-xl p-4" actions={<FormActions submitLabel="List organisation" savingLabel="Listing…" />}>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr_1fr]">
        <Field name="provider" label="Provider">
          {(field) => (
            <SelectInput {...field} className="h-11">
              {BROKER_PROVIDERS.map((p) => <option key={p} value={p}>{BROKER_PROVIDER_LABELS[p]}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field name="orgId" label={provider === "google" ? "Google domain" : "Microsoft tenant ID"} required
          help={provider === "google" ? "The domain Google vouches for, such as advisory.example." : "The tenant's ID, a long code with dashes, not a domain or an address."}>
          {(field) => <Input {...field} className="h-11 font-mono" maxLength={253} autoComplete="off" autoCapitalize="none" spellCheck={false}
            placeholder={provider === "google" ? "advisory.example" : "00000000-0000-0000-0000-000000000000"} />}
        </Field>
        <Field name="label" label="Name of the organisation" required>
          {(field) => <Input {...field} className="h-11" maxLength={80} autoComplete="off" />}
        </Field>
      </div>
    </WorkspaceForm>
  );
};

/** The organisations the firm lists. Someone who signs in at the firm's address from one is listed below as asking to join. */
export const OrganisationsSection = ({ firmId }: { firmId: string }) => {
  const queryClient = useQueryClient();
  const key = ["firm-organisations", firmId];
  const organisations = useQuery({ queryKey: key, queryFn: () => fetchOrganisations(firmId), ...live });
  const [confirming, setConfirming] = useState<string | null>(null);
  const form = useRef<HTMLDivElement>(null);
  const remove = useMutation({
    mutationFn: removeOrganisation,
    onSuccess: () => { toast.success("Removed. People who sign in from it will no longer be listed."); setConfirming(null); },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return (
    <section aria-labelledby="organisations-heading" className="space-y-3">
      <div>
        <h2 id="organisations-heading" className="font-display text-xl font-bold mb-1">Organisations</h2>
        <p className="text-sm text-muted-foreground">
          List your firm's Google domain or Microsoft tenant. Someone who signs in at your firm's address from a listed organisation is shown below
          as asking to join. Nobody becomes a member until you approve them. It is matched on what Google or Microsoft vouches for, never on the
          email address, and a free-mail domain can't be listed.
        </p>
      </div>
      <div ref={form}><OrganisationForm firmId={firmId} onListed={() => queryClient.invalidateQueries({ queryKey: key })} /></div>
      {organisations.isError && !organisations.data && (
        <div role="alert" className="text-sm space-y-2">
          <p className="text-destructive">{organisations.error.message}</p>
          <button className={button} onClick={() => void organisations.refetch()}>Try again</button>
        </div>
      )}
      {organisations.isPending && (
        <div className="flex items-center text-muted-foreground" role="status"><Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> Loading…</div>
      )}
      {organisations.data && organisations.data.length === 0 && (
        // Nothing yet (CRM-S2.2): the form above makes the first one, so the action takes the person to its first field.
        <NothingYet
          layout="line"
          sentence="Organisations you list appear here; until you list one, nobody can ask to join by signing in from it."
          primary={{ label: "List an organisation", onClick: () => form.current?.querySelector<HTMLElement>("input, select")?.focus() }}
        />
      )}
      {organisations.data && organisations.data.length > 0 && (
        <ul aria-label="Listed organisations" className="space-y-2">
          {organisations.data.map((o: ListedOrganisation) => (
            <li key={o.id} className="border border-border rounded-xl p-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-semibold">{providerLabel(o.provider)}</span>
              <span className="font-semibold">{o.label}</span>
              <span className="font-mono text-xs text-muted-foreground break-all">{o.orgId}</span>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {confirming === o.id ? (
                  <>
                    <span className="text-sm">Stop matching it? People who already asked stay in Asked to join.</span>
                    <button className={button} disabled={remove.isPending} onClick={() => remove.mutate(o.id)}>Yes, remove</button>
                    <button className={button} disabled={remove.isPending} onClick={() => setConfirming(null)}>Keep</button>
                  </>
                ) : (
                  <button className={button} onClick={() => setConfirming(o.id)} aria-label={`Remove ${o.label}`}>Remove</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

type Decision = { kind: "approve"; request: JoinRequest; role: JoinRole } | { kind: "decline"; request: JoinRequest };

/**
 * The people who signed in at the firm's address from a listed organisation and asked to join. An owner approves one with a role (the
 * team stays empty until teams have a screen, CRM-X1.1) or declines. The role starts at agent, the least access.
 */
export const AskedToJoinSection = ({ firmId, firmName }: { firmId: string; firmName: string }) => {
  const queryClient = useQueryClient();
  const key = ["firm-join-requests", firmId];
  const requests = useQuery({ queryKey: key, queryFn: () => fetchJoinRequests(firmId), ...live });
  const [roles, setRoles] = useState<Record<string, JoinRole>>({});
  const [declining, setDeclining] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: (d: Decision): Promise<JoinRole | undefined> => (d.kind === "approve" ? approveJoinRequest(d.request.id, d.role) : declineJoinRequest(d.request.id).then(() => undefined)),
    onSuccess: (held, d) => {
      // The role the database says the person holds, which is not the one picked when they had become a member another way meanwhile.
      toast.success(d.kind === "approve" ? `${d.request.email} is now ${WITH_ARTICLE[held ?? d.role]} of ${firmName}.` : `Declined ${d.request.email}.`);
      setDeclining(null);
    },
    onError: (err: Error) => toast.error(err.message),
    // Whatever happened, what the database holds now is what the owner sees.
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return (
    <section aria-labelledby="asked-heading" className="space-y-3">
      <div>
        <h2 id="asked-heading" className="font-display text-xl font-bold mb-1">Asked to join</h2>
        <p className="text-sm text-muted-foreground">
          People who signed in at your firm's address from one of the organisations above. They can't see anything until you approve them.
        </p>
      </div>
      {requests.isError && !requests.data && (
        <div role="alert" className="text-sm space-y-2">
          <p className="text-destructive">{requests.error.message}</p>
          <button className={button} onClick={() => void requests.refetch()}>Try again</button>
        </div>
      )}
      {requests.isPending && (
        <div className="flex items-center text-muted-foreground" role="status"><Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> Loading…</div>
      )}
      {/* Nothing yet (CRM-S2.2), with no action: people ask by signing in, an owner cannot make a request. */}
      {requests.data && requests.data.length === 0 && <NothingYet layout="line" sentence="People who ask to join from a listed organisation appear here." />}
      {requests.data && requests.data.length > 0 && (
        <ul aria-label="Asked to join" className="space-y-3">
          {requests.data.map((r: JoinRequest) => {
            const role = roles[r.id] ?? "agent";
            return (
              <li key={r.id} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-semibold break-all">{r.email}</span>
                  <span className="text-xs text-muted-foreground">{`Asked ${formatDateTime(r.askedAt)}`}</span>
                  <span className="text-xs border border-border rounded px-1.5 py-0.5">{`${providerLabel(r.provider)}: ${r.organisation}`}</span>
                </div>
                {declining === r.id ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{`Decline ${r.email}? They won't be listed again when they sign in. You can still invite them by email.`}</span>
                    <button className={button} disabled={decide.isPending} onClick={() => decide.mutate({ kind: "decline", request: r })}>Yes, decline</button>
                    <button className={button} disabled={decide.isPending} onClick={() => setDeclining(null)}>Keep waiting</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm" htmlFor={`role-${r.id}`}>Role</label>
                    <SelectInput id={`role-${r.id}`} aria-label={`Role for ${r.email}`} className="h-11 w-36" value={role}
                      onChange={(e) => setRoles((prev) => ({ ...prev, [r.id]: e.target.value as JoinRole }))}>
                      {ROLES.map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}
                    </SelectInput>
                    <button className={button} disabled={decide.isPending} aria-label={`Approve ${r.email}`}
                      onClick={() => decide.mutate({ kind: "approve", request: r, role })}>Approve</button>
                    <button className={button} disabled={decide.isPending} aria-label={`Decline ${r.email}`} onClick={() => setDeclining(r.id)}>Decline</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
