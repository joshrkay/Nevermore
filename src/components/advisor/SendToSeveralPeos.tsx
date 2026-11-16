import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import MailboxForWriting from "@/components/mailbox/MailboxForWriting";
import { useFirstSend } from "@/components/mailbox/useFirstSend";
import { failureWords } from "@/components/workspace/form";
import { FIT_WORDS, NOT_MET_NOTE, fitOutcome, peoFit, type FitStatus, type PeoRecord } from "@/data/peoCatalog";
import { groupByCompleteness, type CertifiedVersion, type PeoCompletenessEntry } from "@/data/peoCompleteness";
import { localToday } from "@/data/peoProfiles";
import { peoGreeting, peoSendSubject } from "@/data/peoSend";
import type { ChamberSubmission } from "@/data/manuscript";
import { bundleSummary, planBundle, type BundleSource } from "@/data/submissionBundle";
import { peoLinkIssuer } from "@/lib/peoLinkIssuer";
import { loadPeoSendContext, sendToPeo, type PeoSendContext } from "@/lib/peoSendApi";
import { loadPeoAuthorizations, type PeoAuthorizationState } from "@/lib/peoAuthorizationsApi";
import { loadRegisteredElsewhere, type RegisteredElsewhere } from "@/lib/peoRegistrationsApi";
import { registeredElsewhereWords } from "@/data/peoRegistrations";
import { STATE_WORDS, askToAddAnyPeo, askToAddPeo } from "@/data/peoAuthorizationWords";
import { requestInformation } from "@/lib/advisorApi";

export interface SendToSeveralPeosProps {
  sessionId: string;
  /** The last certified version, which each PEO's completeness, checks and bundle are worked out from. */
  certified: CertifiedVersion;
  catalog: readonly PeoRecord[];
  /** The certification on record, which each PEO's packet is stamped with. */
  submission: ChamberSubmission;
  fileId: string;
  companyName: string;
  /** This page, to come back to after connecting a mailbox. */
  returnTo: string;
  /** Open as soon as it is drawn (Choose PEOs on an opportunity's page opens it once the submission is read). */
  startOpen?: boolean;
  /** What the button that opens it says (Choose PEOs on an opportunity's page). Default: Send to several PEOs. */
  openLabel?: string;
  /** After the sends, once any went. */
  onSent: () => void;
}

/** A PEO as the choosing step lists it: what it still needs to quote and the eligibility checks it doesn't meet, either of which makes it not ready. */
interface Choice {
  peo: string;
  entry: PeoCompletenessEntry;
  missing: string[];
  notMet: string[];
  ready: boolean;
  /** Where the PEO stands across its eligibility checks, and the first check that says so (CRM-Q2.5). */
  fit: { outcome: FitStatus; reason: string | null };
}

type Step = "choose" | "review" | "done";

/** How each chosen PEO's send went: sent, or not sent with the reason. */
interface Outcome {
  peo: string;
  sent: boolean;
  words: string;
  /** The send itself failed, so it can be tried again (a PEO stopped before the send can't). */
  retry?: boolean;
}

/**
 * Send to several PEOs at once (M-2.2): every listed PEO with a profile, ticked when it is ready (nothing missing to quote and no eligibility check
 * not met) and unticked, with what it is missing, when it isn't. The advisor writes one note; a review shows each chosen PEO's recipients, greeting,
 * files and gaps; then each is sent its own message by 6.6's per-PEO send, to its own people only, with its own link from its own plan.
 */
const SendToSeveralPeos = (p: SendToSeveralPeosProps) => {
  const id = useId();
  const [open, setOpen] = useState(p.startOpen ?? false);
  const [step, setStep] = useState<Step>("choose");
  // Each PEO's composer read (peo_send_context): its people with an email; "failed" when it couldn't be read, which stops that PEO alone.
  const [contexts, setContexts] = useState<Record<string, PeoSendContext | "failed">>({});
  const [subject, setSubject] = useState(peoSendSubject(p.companyName, p.fileId, p.certified.version));
  const [note, setNote] = useState("");
  const [authorizations, setAuthorizations] = useState<PeoAuthorizationState[] | null>(null);
  // Q-2.2 (D-604): the PEOs another firm registered this employer with, and when; never who. It warns and never stops a PEO.
  const [elsewhere, setElsewhere] = useState<RegisteredElsewhere[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [busy, setBusy] = useState(false);
  // The PEOs the employer was asked to add from here (CRM-Q2.5), so the ask isn't made twice.
  const [asked, setAsked] = useState<string[]>([]);
  const [askFailed, setAskFailed] = useState<Record<string, string>>({});
  const ask = async (peo: string, message = askToAddPeo(peo)) => {
    try {
      await requestInformation(p.sessionId, message, []);
      setAsked((now) => [...now, peo]);
      setAskFailed(({ [peo]: _gone, ...rest }) => rest);
    } catch (err) {
      setAskFailed((now) => ({ ...now, [peo]: failureWords(err, "The request didn't go through. Check your connection and try again.") }));
    }
  };
  // No "Send from your own mail" here: each PEO has its own reply address to put in CC, so that is done one PEO at a time, on its card (D-1604).
  const { beforeSend, choice } = useFirstSend({ returnTo: p.returnTo });
  const today = localToday();
  const groups = groupByCompleteness(p.certified.intake, p.certified.documents, p.catalog);
  const choices: Choice[] = [...groups.complete, ...groups.missing]
    .map((entry) => {
      const missing = entry.completeness.toQuote.map((i) => i.label);
      const checks = peoFit(p.certified.intake.data, entry.peo, today);
      const notMet = checks.filter((c) => c.status === "does_not_meet").map((c) => `${FIT_WORDS[c.status]} · ${c.label}`);
      const outcome = fitOutcome(checks);
      return { peo: entry.peo.name, entry, missing, notMet, ready: missing.length + notMet.length === 0, fit: { outcome, reason: checks.find((c) => c.status === outcome)?.sentence ?? null } };
    })
    .sort((a, b) => a.peo.localeCompare(b.peo));
  const [ticked, setTicked] = useState<string[]>(() => choices.filter((c) => c.ready).map((c) => c.peo));
  const toggle = (peo: string) => setTicked((now) => (now.includes(peo) ? now.filter((x) => x !== peo) : [...now, peo]));
  const chosen = choices.filter((c) => ticked.includes(c.peo));
  const peoNames = choices.map((c) => c.peo).join("\n");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // The employer's say for each PEO (M-1.1). Unread, the database still refuses a send without it, and the result says so.
    loadPeoAuthorizations(p.sessionId).then((rows) => {
      if (cancelled) return;
      setAuthorizations(rows);
      // A PEO the employer hasn't authorized can't be ticked (CRM-Q2.5): any tick it started with goes.
      setTicked((now) => now.filter((peo) => rows.find((a) => a.peo.toLowerCase() === peo.toLowerCase())?.state === "authorized"));
    }, () => undefined);
    // Unread, there is simply no warning: no send waits on it.
    loadRegisteredElsewhere(p.sessionId).then((rows) => !cancelled && setElsewhere(rows), () => undefined);
    for (const peo of peoNames.split("\n").filter(Boolean)) {
      loadPeoSendContext(p.sessionId, peo).then(
        (c) => !cancelled && setContexts((now) => ({ ...now, [peo]: c })),
        () => !cancelled && setContexts((now) => ({ ...now, [peo]: "failed" })),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [open, p.sessionId, peoNames]);

  // Each PEO's advisor bundle, from the last certified version: what its link carries and the open items its message lists.
  const sourceOf = (c: Choice): BundleSource => ({
    audience: "advisor", peo: c.entry.peo, catalog: p.catalog, intake: p.certified.intake, documents: p.certified.documents,
    submission: p.submission, fileId: p.fileId, version: p.certified.version, changedSince: p.certified.changedSince, today,
  });
  const peopleOf = (c: Choice) => {
    const read = contexts[c.peo];
    return read && read !== "failed" ? read.contacts : [];
  };
  const greetingOf = (c: Choice) => peoGreeting(peopleOf(c).map((x) => x.name));

  // What stops this PEO alone, in the database's own words (assert_peo_authorized, D-625); the rest still go.
  const stopOf = (c: Choice): string | null => {
    const state = authorizations?.find((a) => a.peo.toLowerCase() === c.peo.toLowerCase())?.state;
    if (state === "withdrawn") return `The employer withdrew ${c.peo}. Nothing more can be sent to it.`;
    if (authorizations && state !== "authorized") return `The employer hasn't authorized ${c.peo} to receive their packet. Ask them to add it.`;
    if (contexts[c.peo] === "failed") return `We couldn't load ${c.peo}'s contacts. Close this and open it again to try again.`;
    if (contexts[c.peo] && peopleOf(c).length === 0) return `${c.peo}'s profile has no contact with an email, so there is nobody to send it to.`;
    return null;
  };
  // The employer as the agent says them: the certifier's first name.
  const employer = p.submission.signer_name?.trim().split(/\s+/)[0] || "the employer";
  const stateOf =(c: Choice) => authorizations?.find((a) => a.peo.toLowerCase() === c.peo.toLowerCase())?.state;
  // CRM-Q2.5: the employer's say is read and none of the listed PEOs is authorized, so there is nothing to continue with.
  const noneAuthorized = !!authorizations && choices.every((c) => stateOf(c) !== "authorized");
  const going = chosen.filter((c) => stopOf(c) === null);

  // One PEO's send, one at a time as each locks the submission's pipeline row; a refusal stops this PEO alone. `retry`: it failed in the send itself, so it may be tried again.
  const sendOne = async (c: Choice): Promise<Outcome> => {
    const stop = stopOf(c);
    if (stop) return { peo: c.peo, sent: false, words: stop };
    try {
      await sendToPeo({
        sessionId: p.sessionId,
        peo: c.peo,
        to: peopleOf(c).map((x) => x.email),
        subject,
        note: `${greetingOf(c)}\n\n${note}`,
        issueLink: peoLinkIssuer(sourceOf(c)),
      });
      return { peo: c.peo, sent: true, words: `It is on the ${c.peo} thread.` };
    } catch (err) {
      return { peo: c.peo, sent: false, retry: true, words: failureWords(err, "The send didn't go through. Check your connection and try again.") };
    }
  };

  const send = async () => {
    const done: Outcome[] = [];
    for (const c of chosen) done.push(await sendOne(c));
    setOutcomes(done);
    setStep("done");
    if (done.some((o) => o.sent)) p.onSent();
  };

  // Try again (CRM-Q2.6): that PEO alone, through the same mailbox check as the first send.
  const retry = async (peo: string) => {
    const c = chosen.find((x) => x.peo === peo);
    if (!c) return;
    const again = await sendOne(c);
    setOutcomes((now) => now.map((o) => (o.peo === peo ? again : o)));
    if (again.sent) p.onSent();
  };

  // Opening again starts over: the choosing step, and each PEO's contacts and the employer's say read afresh.
  const close = () => {
    setOpen(false);
    setStep("choose");
    setContexts({});
    setAuthorizations(null);
    setElsewhere([]);
    setOutcomes([]);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-4 rounded-md border border-primary text-primary text-sm font-medium">
        {p.openLabel ?? "Send to several PEOs"}
      </button>
    );
  }
  return (
    <section aria-label="Send to several PEOs" className="border border-border rounded-md p-3 space-y-3 text-sm">
      {step !== "done" && <MailboxForWriting returnTo={p.returnTo} />}
      {step === "choose" && choices.length === 0 ? (
        <p className="text-sm">No PEOs are listed yet. Ask Nevermore to list the PEOs you quote with.</p>
      ) : step === "choose" ? (
        <>
          <ul className="space-y-2">
            {choices.map((c) => (
              <li key={c.peo} className="space-y-0.5">
                <label className="flex items-center gap-2 min-h-11">
                  <input type="checkbox" checked={ticked.includes(c.peo)} disabled={!!authorizations && stateOf(c) !== "authorized"} onChange={() => toggle(c.peo)} />
                  <span className="font-medium">{c.peo}</span>
                </label>
                <p className="text-xs">{`${FIT_WORDS[c.fit.outcome]}${c.fit.reason ? ` · ${c.fit.reason}` : ""}`}</p>
                {stateOf(c) && <p className="text-xs">{STATE_WORDS[stateOf(c)!]}</p>}
                {peopleOf(c).length > 0 && <p className="text-xs">{`Contact: ${peopleOf(c).map((x) => `${x.name}${x.role ? ` (${x.role})` : ""}`).join(", ")}`}</p>}
                {authorizations && stateOf(c) !== "authorized" && (asked.includes(c.peo) ? (
                  <p className="text-xs">{`Asked ${employer} to add ${c.peo}.`}</p>
                ) : (
                  <>
                    <button type="button" onClick={() => void ask(c.peo)} className="text-xs text-primary underline underline-offset-2">
                      {`Ask ${employer} to add ${c.peo}`}
                    </button>
                    {askFailed[c.peo] && <p role="alert" className="text-xs text-destructive">{askFailed[c.peo]}</p>}
                  </>
                ))}
                <p className="text-xs text-muted-foreground">{c.ready ? "Ready" : `Not ready: ${[...c.missing, ...c.notMet].join("; ")}`}</p>
              </li>
            ))}
          </ul>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Subject</span>
            <input value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} className="w-full min-h-11 bg-muted border border-border rounded-md px-3" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Your note</span>
            <textarea value={note} maxLength={50000} rows={5} onChange={(e) => setNote(e.target.value)} className="w-full bg-muted border border-border rounded-md px-3 py-2" />
          </label>
          {noneAuthorized && (
            <p className="text-sm">
              {`${employer} hasn't authorized a PEO yet.`}{" "}
              <button type="button" onClick={() => void ask("", askToAddAnyPeo(choices.map((c) => c.peo)))} className="text-primary underline underline-offset-2">{`Ask ${employer}`}</button>
            </p>
          )}
          <button type="button" disabled={noneAuthorized} onClick={() => setStep("review")} className="min-h-11 px-4 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60">Review</button>
        </>
      ) : step === "done" ? (
        <ul aria-label="What was sent" className="space-y-1">
          {outcomes.map((o) => (
            <li key={o.peo} className={o.sent ? "" : "text-destructive"}>
              {`${o.peo}: ${o.sent ? "Sent" : "Not sent"}. ${o.words}`}
              {o.retry && <button type="button" onClick={() => void beforeSend(() => retry(o.peo))} className="ml-2 underline underline-offset-2">{`Try again with ${o.peo}`}</button>}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="space-y-2">
            {chosen.map((c) => {
              const plan = planBundle(sourceOf(c));
              const items = plan.missing.map((m) => m.label);
              const stop = stopOf(c);
              const registered = registeredElsewhereWords(elsewhere, c.peo);
              return (
                <li key={c.peo}>
                  <article aria-labelledby={`${id}-${c.entry.peo.id ?? c.peo}`} className="rounded-md bg-muted p-2 space-y-0.5">
                    <h4 id={`${id}-${c.entry.peo.id ?? c.peo}`} className="font-medium">{c.peo}</h4>
                    <p>{`To: ${peopleOf(c).map((x) => `${x.name}${x.role ? `, ${x.role}` : ""} (${x.email})`).join(", ")}`}</p>
                    <p className="text-xs text-muted-foreground">{`Opens with "${greetingOf(c)}", then your note.`}</p>
                    <p className="text-xs">{bundleSummary(plan)}</p>
                    <p className="text-xs">{`Open items: ${items.length > 0 ? items.join("; ") : "none"}`}</p>
                    {c.notMet.length > 0 && <p className="text-xs text-warning">{`${c.notMet.join("; ")}. ${NOT_MET_NOTE}`}</p>}
                    {registered && <p role="note" className="text-xs text-warning">{registered}</p>}
                    {stop && <p className="text-xs text-destructive">{`Won't be sent: ${stop}`}</p>}
                  </article>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || going.length === 0}
              onClick={() => {
                setBusy(true);
                void beforeSend(send).finally(() => setBusy(false));
              }}
              className="min-h-11 px-4 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {`Send to ${going.length} PEO${going.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" disabled={busy} onClick={() => setStep("choose")} className="min-h-11 px-4 rounded-md border border-border">Back</button>
          </div>
        </>
      )}
      <button type="button" disabled={busy} onClick={close} className="min-h-11 px-4 rounded-md border border-border">Close</button>
      {choice}
    </section>
  );
};

export default SendToSeveralPeos;
