import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BellRing, Loader2, MailWarning } from "lucide-react";
import AdvisorLoadError from "@/components/advisor/AdvisorLoadError";
import AuditTrail from "@/components/advisor/AuditTrail";
import DocumentsPanel from "@/components/advisor/DocumentsPanel";
import FieldReviewPanel from "@/components/advisor/FieldReviewPanel";
import InformationRequestPanel from "@/components/advisor/InformationRequestPanel";
import ManuscriptPanel from "@/components/advisor/ManuscriptPanel";
import NeedsActionPanel from "@/components/advisor/NeedsActionPanel";
import NotesPanel from "@/components/advisor/NotesPanel";
import PeoNeedsPanel from "@/components/advisor/PeoNeedsPanel";
import PeoThreadPanel from "@/components/advisor/PeoThreadPanel";
import QuoteRequestsPanel from "@/components/advisor/QuoteRequestsPanel";
import CensusDownload from "@/components/CensusDownload";
import { DownloadsOffNotice } from "@/components/workspace/downloadsOff";
import { usePeoCatalog } from "@/hooks/usePeoCatalog";
import { MENU_COUNTS_KEY } from "@/lib/menuCountsApi";
import StatusPanel from "@/components/advisor/StatusPanel";
import TranscriptEvidence from "@/components/advisor/TranscriptEvidence";
import { formatDateTime, messageAnchor } from "@/components/advisor/format";
import { changesSinceSigning, informationRequestBlockedReason, NEEDS_ACTION_LABEL, verifiedFieldsOf } from "@/data/advisor";
import { censusPay, isW2 } from "@/data/census";
import { coverageTier, NOT_PROVIDED } from "@/data/manuscript";
import { emailProblemHelp, emailProblemLabel } from "@/data/outbox";
import { describeSource } from "@/data/referralPartners";
import { lastCertifiedVersion } from "@/data/peoCompleteness";
import type { FieldKey } from "@/data/provenance";
import type { ExtraQuestionRef } from "@/data/extraAnswers";
import { recordSubmissionFileDownload } from "@/lib/activityReports";
import { listEmailProblems, loadSubmission, type EmailProblem, type SubmissionDetail } from "@/lib/advisorApi";
import { certificationOf } from "@/lib/certificationCheck";

type Load =
  | { kind: "loading" }
  | { kind: "error"; error: Error }
  | { kind: "not_found" }
  | { kind: "ready"; detail: SubmissionDetail };

const AdvisorSubmissionPage = () => {
  const { id = "" } = useParams();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The submission whose opening the database has recorded, so a reload after a change is not another opening.
  const openedRef = useRef<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [emailProblem, setEmailProblem] = useState<EmailProblem | null>(null);

  // Read beside the submission, not as part of it: if this fails, the submission still loads.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => listEmailProblems())
      .then((rows) => !cancelled && setEmailProblem(rows.find((r) => r.session_id === id) ?? null))
      .catch(() => !cancelled && setEmailProblem(null));
    return () => { cancelled = true; };
  }, [id, attempt]);

  useEffect(() => {
    let cancelled = false;
    // Keep showing the current detail while refreshing after a change.
    setLoad((prev) => (prev.kind === "ready" && prev.detail.id === id ? prev : { kind: "loading" }));
    // The first load of a submission on screen is its opening, which the database records; a reload after a change is not.
    const opening = openedRef.current !== id;
    loadSubmission(id, opening)
      .then((detail) => {
        openedRef.current = id;
        return detail;
      })
      .then((detail) => !cancelled && setLoad(detail ? { kind: "ready", detail } : { kind: "not_found" }))
      .catch((error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [id, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const showMessage = useCallback((messageId: string) => {
    setHighlighted(messageId);
    document.getElementById(messageAnchor(messageId))?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, []);

  const messageIds = useMemo(
    () => new Set(load.kind === "ready" ? load.detail.transcript.map((m) => m.id) : []),
    [load],
  );

  return (
    <div className="bg-background">
      <main className="container mx-auto px-6 py-8">
        <Link to="/advisor" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> All submissions
        </Link>

        {load.kind === "loading" && (
          <div className="flex items-center justify-center py-24 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> Loading submission…
          </div>
        )}

        {load.kind === "error" && <AdvisorLoadError error={load.error} what="this submission" onRetry={reload} />}

        {load.kind === "not_found" && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="font-medium">Submission not found.</p>
            <p className="text-sm text-muted-foreground">It may have been removed, or the link is wrong.</p>
          </div>
        )}

        {load.kind === "ready" && (
          <Detail detail={load.detail} reload={reload} messageIds={messageIds} highlighted={highlighted} onShowMessage={showMessage} emailProblem={emailProblem} />
        )}
      </main>
    </div>
  );
};

const Detail = ({
  detail,
  reload,
  messageIds,
  highlighted,
  onShowMessage,
  emailProblem,
}: {
  detail: SubmissionDetail;
  reload: () => void;
  messageIds: Set<string>;
  highlighted: string | null;
  onShowMessage: (id: string) => void;
  emailProblem: EmailProblem | null;
}) => {
  // The PEOs and their profiles in use, from the database: the quote requests' fit checks, the packet's checks and
  // the census layouts read them.
  const peoCatalog = usePeoCatalog();
  // A thread marked read clears the mark on the queue; the menu's Inbox count follows at once, not at its next refresh (story CRM-S1.1c).
  const queryClient = useQueryClient();
  const refreshMenuCounts = useCallback(() => void queryClient.invalidateQueries({ queryKey: [...MENU_COUNTS_KEY] }), [queryClient]);
  const threadOpened = useCallback(() => { reload(); refreshMenuCounts(); }, [reload, refreshMenuCounts]);
  // A change to a quote request or to the status (a send recorded, a quote received or declined, Won or Lost closing the rest) moves the
  // Quotes count, so the menu is told at once too, not at its next refresh.
  const quotesChanged = useCallback(() => { reload(); refreshMenuCounts(); }, [reload, refreshMenuCounts]);
  // An underwriter's question the advisor chose to ask the prospect: it opens Ask the prospect with the text in it,
  // as a fresh draft each time, for the advisor to edit and send as their own request.
  // What a PEO still needs comes the same way, with the answers the request names. Once a request is sent the
  // draft is spent: the next one starts afresh, from the fields marked Needs follow-up. `n` only ever grows, so each
  // draft, and each send, starts the panel anew.
  const [askDraft, setAskDraft] = useState<{ message?: string; fields?: FieldKey[]; questions?: ExtraQuestionRef[]; n: number }>({ n: 0 });
  const askProspect = (message: string, fields?: FieldKey[], questions?: ExtraQuestionRef[]) => {
    setAskDraft((current) => ({ message, fields, questions, n: current.n + 1 }));
    window.requestAnimationFrame?.(() => document.getElementById("information-request-message")?.focus());
  };
  const requestSent = () => {
    setAskDraft((current) => ({ n: current.n + 1 }));
    reload();
  };
  // What each PEO still needs is built from the last certified version, never from answers given since.
  const certifiedVersion = lastCertifiedVersion(detail, verifiedFieldsOf(detail.reviews));
  const sub = detail.submission;
  // The certification the page's files were built from, checked again at each download's click.
  const builtFrom = certificationOf(detail.id, detail.intakeStatus, sub ?? {});
  return (
    <>
      {emailProblem && (
        <div role="alert" className="mb-6 flex gap-3 border border-destructive/40 bg-destructive/5 rounded-xl p-4 text-sm">
          <MailWarning className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-medium">{emailProblemLabel(emailProblem.reason)}.</strong> {emailProblemHelp(emailProblem.reason)}
            {detail.phone && ` Phone on file: ${detail.phone}.`}
          </p>
        </div>
      )}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{detail.data.company_name ?? "Company not provided"}</h1>
          {detail.needsAction.on && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning whitespace-nowrap">
              <BellRing className="w-3 h-3" aria-hidden="true" /> {NEEDS_ACTION_LABEL}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-mono">{detail.fileId ?? "File ID assigned when the prospect certifies"}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {detail.certified && sub
            ? `Certified by ${sub.signer_name}${sub.signer_title ? `, ${sub.signer_title}` : ""} · ${formatDateTime(sub.certified_at ?? sub.signed_at)}${sub.peo ? ` · Prepared for ${sub.peo}` : ""}`
            : sub?.signer_name
              ? `Certification withdrawn: the prospect changed their answers after signing. Showing their current answers${detail.signed ? "; what changed is listed below" : ""}.`
              : "Not certified yet. Showing the prospect's answers so far."}
          {detail.contactName && ` · Contact: ${detail.contactName}`}
          {detail.phone && ` · ${detail.phone}`}
        </p>
        <p className="text-sm text-muted-foreground mt-1">Source: {describeSource(detail.source, detail.sourcePartnerName)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6 min-w-0">
          {detail.signed && <ChangedSinceSigning detail={detail} signed={detail.signed} />}
          <PeoNeedsPanel
            certified={certifiedVersion}
            catalog={peoCatalog.peos}
            catalogStatus={peoCatalog.status}
            onRetryCatalog={peoCatalog.retry}
            chosenPeo={sub?.peo ?? null}
            quoteRequests={detail.quoteRequests}
            askBlocked={informationRequestBlockedReason(detail.pipelineStatus, !!sub?.signer_name, detail.intakeStatus)}
            onDraft={(draft) => askProspect(draft.message, draft.fields, draft.questions)}
            fileId={detail.fileId ?? "No File ID"}
            builtFrom={builtFrom}
            submission={sub}
            sessionId={detail.id}
            stage={detail.pipelineStatus}
            onSendRecorded={quotesChanged}
            companyName={certifiedVersion?.intake.data.company_name ?? "Company not provided"}
          />
          <PeoThreadPanel
            prospectUserId={detail.userId}
            requests={detail.quoteRequests}
            messages={detail.quoteRequestMessages}
            attachments={detail.quoteRequestMailAttachments}
            notes={detail.quoteRequestNotes}
            events={detail.quoteRequestEvents}
            reads={detail.quoteRequestThreadReads}
            onOpened={threadOpened}
          />
          <FieldReviewPanel
            sessionId={detail.id}
            data={detail.data}
            storedAnswers={detail.storedAnswers}
            provenance={detail.provenance}
            reviews={detail.reviews}
            messageIds={messageIds}
            onShowMessage={onShowMessage}
            onChanged={reload}
            census={<CensusTable detail={detail} />}
          />
          <TranscriptEvidence
            messages={detail.transcript}
            highlighted={highlighted}
            changedSinceCertified={detail.transcriptChangedSinceCertified}
          />
        </div>
        <div className="space-y-6">
          <NeedsActionPanel
            key={`${detail.needsAction.on}-${detail.needsAction.at}`}
            sessionId={detail.id}
            prospectUserId={detail.userId}
            needsAction={detail.needsAction}
            onChanged={reload}
          />
          <InformationRequestPanel
            // A sent request starts the next one afresh, from the fields marked Needs follow-up; until then the
            // panel follows the marks as they change.
            key={`${detail.informationRequests.length}-${askDraft.n}`}
            initialMessage={askDraft.message}
            initialFields={askDraft.fields}
            initialQuestions={askDraft.questions}
            sessionId={detail.id}
            prospectUserId={detail.userId}
            status={detail.pipelineStatus}
            certifiedOnce={!!detail.submission?.signer_name}
            intakeStatus={detail.intakeStatus}
            reviews={detail.reviews}
            requests={detail.informationRequests}
            onChanged={requestSent}
          />
          <QuoteRequestsPanel
            sessionId={detail.id}
            prospectUserId={detail.userId}
            status={detail.pipelineStatus}
            currentVersion={detail.currentVersion}
            requests={detail.quoteRequests}
            events={detail.quoteRequestEvents}
            notes={detail.quoteRequestNotes}
            addresses={detail.quoteRequestAddresses}
            mail={detail.quoteRequestMessages}
            threadReads={detail.quoteRequestThreadReads}
            data={detail.data}
            catalog={peoCatalog.peos}
            onAskProspect={(message) => askProspect(message)}
            onChanged={quotesChanged}
          />
          <StatusPanel
            key={detail.pipelineStatus}
            sessionId={detail.id}
            prospectUserId={detail.userId}
            status={detail.pipelineStatus}
            certified={detail.certified}
            certifiedOnce={!!detail.submission?.signer_name}
            history={detail.history}
            quoteRequests={detail.quoteRequests}
            onChanged={quotesChanged}
          />
          <ManuscriptPanel detail={detail} catalog={peoCatalog.peos} catalogStatus={peoCatalog.status} onRetryCatalog={peoCatalog.retry} onChanged={reload} />
          <DocumentsPanel documents={detail.documents} events={detail.documentEvents} prospectUserId={detail.userId} />
          <NotesPanel sessionId={detail.id} notes={detail.notes} onAdded={reload} />
          <AuditTrail events={detail.reviewEvents} prospectUserId={detail.userId} />
        </div>
      </div>
    </>
  );
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: "Spouse",
  domestic_partner: "Domestic partner",
  child: "Child",
  other: "Other",
};

/** What the prospect certified beside what the intake holds now, for an intake edited after signing. */
const ChangedSinceSigning = ({ detail, signed }: { detail: SubmissionDetail; signed: NonNullable<SubmissionDetail["signed"]> }) => {
  const changes = changesSinceSigning(signed.data, detail.data);
  // A PEO's own answers go only to that PEO, so they aren't listed here: only that one changed.
  const extraChanged = JSON.stringify(signed.extraAnswers) !== JSON.stringify(detail.extraAnswers);
  return (
    <section aria-labelledby="changed-heading" className="border border-warning/40 bg-warning/5 rounded-xl p-5">
      <h2 id="changed-heading" className="font-display text-lg font-bold">Changed since signing</h2>
      <p className="text-xs text-muted-foreground mb-3">Signed {formatDateTime(signed.signedAt)}</p>
      {extraChanged && (
        <p className="text-sm text-muted-foreground mb-2">An answer to a PEO's own questions changed since signing. Each PEO's supplement keeps the certified answers.</p>
      )}
      {changes.length === 0 ? (
        !extraChanged && <p className="text-sm text-muted-foreground">No answer differs from the signed copy.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-1.5 pr-3 font-medium">Field</th>
                <th className="py-1.5 pr-3 font-medium">As signed</th>
                <th className="py-1.5 font-medium">Now</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.field} className="border-b border-border last:border-0 align-top">
                  <td className="py-1.5 pr-3">{c.label}</td>
                  <td className="py-1.5 pr-3 font-mono">{c.signed}</td>
                  <td className="py-1.5 font-mono">{c.current}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/** The census as the Manuscript prints it, under the census's row in the Workforce section. */
const CensusTable = ({ detail }: { detail: SubmissionDetail }) => (
  <section aria-labelledby="census-heading" className="border border-border rounded-lg p-4">
    <h4 id="census-heading" className="text-sm font-medium mb-3">Employee census</h4>
    {/* The certified census as a file in our own layout (#86): only from the certified copy, never a draft. Each PEO's
        own layout is on its card in What each PEO still needs (L-3.1). */}
    {detail.certified && detail.fileId && detail.data.census.length > 0 && (
      <div className="mb-3">
        <DownloadsOffNotice />
        <CensusDownload census={detail.data.census} fileId={detail.fileId} version={detail.currentVersion} peo={null} catalog={[]} builtFrom={certificationOf(detail.id, detail.intakeStatus, detail.submission ?? {})} onDownloaded={() => recordSubmissionFileDownload(detail.id)} />
      </div>
    )}
    {detail.data.census.length === 0 ? (
      <p className="text-sm text-muted-foreground">No census captured.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-3">Name</th>
              <th className="py-1 pr-3">DOB / age</th>
              <th className="py-1 pr-3">State</th>
              <th className="py-1 pr-3">ZIP</th>
              <th className="py-1 pr-3">Title</th>
              <th className="py-1 pr-3 text-right">Salary</th>
              <th className="py-1 pr-3">Type</th>
              <th className="py-1 pr-3">Tier (as the packet prints it)</th>
              <th className="py-1 pr-3">WC code</th>
              <th className="py-1">Dependents</th>
            </tr>
          </thead>
          <tbody>
            {detail.data.census.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="py-1 pr-3">{`${e.first_name} ${e.last_name}`.trim() || "—"}</td>
                <td className="py-1 pr-3 font-mono">{e.dob || (e.age !== undefined ? `Age ${e.age}` : "—")}</td>
                <td className="py-1 pr-3">{e.work_state || "—"}</td>
                <td className="py-1 pr-3 font-mono">{e.zip_code ?? "—"}</td>
                <td className="py-1 pr-3">{e.job_title || "—"}</td>
                <td className="py-1 pr-3 text-right font-mono">{censusPay(e)}</td>
                <td className="py-1 pr-3">
                  {e.classification === "1099" ? "1099" : "W-2"}
                  {e.employment_type === "part_time" && " PT"}
                </td>
                <td className="py-1 pr-3">
                  {isW2(e) ? coverageTier(e) ?? NOT_PROVIDED : "Not applicable"}
                  {isW2(e) && !e.coverage_tier && coverageTier(e) && (
                    <span className="block text-xs text-muted-foreground">from dependents</span>
                  )}
                </td>
                <td className="py-1 pr-3 font-mono">{e.class_code ?? "—"}</td>
                <td className="py-1">
                  {(e.dependents?.length ?? 0) === 0 ? (
                    "None"
                  ) : (
                    <ul aria-label={`Dependents of ${`${e.first_name} ${e.last_name}`.trim()}`} className="space-y-0.5">
                      {e.dependents!.map((dep, i) => (
                        <li key={i}>
                          {`${dep.first_name} ${dep.last_name}`.trim()} · {RELATIONSHIP_LABELS[dep.relationship] ?? dep.relationship}
                          {dep.dob && <span className="font-mono"> · {dep.dob}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default AdvisorSubmissionPage;
