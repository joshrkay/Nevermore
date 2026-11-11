import { useEffect, useMemo, useState } from "react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import { CheckCircle, AlertTriangle, Download, ArrowLeft, Loader2 } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ChamberData } from "@/data/chamberTypes";
import { parseChamberData } from "@/data/chamberValidation";
import { CONSENT_DRAFT_LABEL } from "@/data/certification";
import { buildManuscript, CHECK_OUTCOME, isFileId, manuscriptFilename, maskDob, NOT_PROVIDED, rowProvenance, rowSourceLine, type ChamberSubmission, type Manuscript, type ManuscriptRow } from "@/data/manuscript";
import { parseProvenance, STATUS_LABELS, type FieldKey, type FieldProvenance, type ProvenanceMap } from "@/data/provenance";
import { checkedLine, localToday } from "@/data/peoProfiles";
import { FIT_WORDS, listedPeos, NOT_MET_NOTE } from "@/data/peoCatalog";

/** A packet check's outcome in the words the eligibility checks use everywhere. */
import { buildManuscriptPdf } from "@/lib/manuscriptPdf";
import { NO_VERIFIED_FIELDS } from "@/data/requiredItems";
import { readVerifiedFields } from "@/lib/verifiedFields";
import { SITE_DOMAIN } from "@/data/site";
import { downloadBlob } from "@/lib/downloadFile";
import { recordManuscriptDownload } from "@/lib/milestones";
import CensusDownload from "@/components/CensusDownload";
import SupplementDownload from "@/components/SupplementDownload";
import { parseExtraAnswers } from "@/data/extraAnswers";
import { buildSupplement, supplementPeos } from "@/data/peoSupplement";
import FitIcon from "@/components/peo/FitIcon";
import { usePeoCatalog } from "@/hooks/usePeoCatalog";
import { finalManuscriptUrl } from "@/lib/advisorApi";
import ProspectStatusNote from "@/components/ProspectStatusNote";
import LegalLinks from "@/components/LegalLinks";

const SAMPLE_FILE_ID = "EAA-SAMPLE";
const SAMPLE_DATE = new Date("2026-03-02T12:00:00Z");
// The sample is a finished intake: every answer confirmed by its fictional prospect.
const SAMPLE_PROVENANCE: ProvenanceMap = Object.fromEntries(
  (Object.keys(DEMO_CHAMBER_DATA) as FieldKey[]).map((field) => [field, { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: SAMPLE_DATE.toISOString() }]),
);

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-display text-lg font-bold mb-4 pl-4 border-l-4 border-primary">{children}</h3>
);

const STATUS_MARKER_CLASS: Record<FieldProvenance["status"], string> = {
  confirmed: "bg-success/15 text-success",
  inferred: "bg-warning/15 text-warning",
  incomplete: "bg-warning/15 text-warning",
  conflicting: "bg-destructive/15 text-destructive",
  unknown: "bg-warning/15 text-warning",
  not_applicable: "bg-muted text-muted-foreground",
};

// A status shows beside an answer. Beside "Not provided" it shows only when it says more: unknown and
// not applicable hold no answer on purpose, and a conflict always shows, as the PDF marks it.
const showsStatus = (value: string, provenance?: FieldProvenance): provenance is FieldProvenance =>
  Boolean(provenance) &&
  (value !== NOT_PROVIDED || provenance!.status === "conflicting" || provenance!.status === "unknown" || provenance!.status === "not_applicable");

// Shows whether a value was confirmed or only inferred, and where it came from (an answered row only: rowSourceLine).
const DataRow = ({ label, value, provenance, source }: { label: string; value: string; provenance?: FieldProvenance; source: string | null }) => (
  <div className="py-2 border-b border-border last:border-0">
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-mono text-sm text-foreground text-right">
        {value}
        {showsStatus(value, provenance) && (
          <span className={`ml-2 text-[10px] font-sans px-1.5 py-0.5 rounded-full ${STATUS_MARKER_CLASS[provenance.status]}`}>
            {STATUS_LABELS[provenance.status]}
          </span>
        )}
      </span>
    </div>
    {source && <p className="text-[11px] text-muted-foreground text-right mt-0.5">{source}</p>}
  </div>
);

const renderRows = (rows: ManuscriptRow[], m: Pick<Manuscript, "provenance" | "answered">) =>
  rows.map((row) => (
    <DataRow key={row[0]} label={row[0]} value={row[1]} provenance={rowProvenance(row, m.provenance)} source={rowSourceLine(row, m)} />
  ));

const Card = ({ children }: { children: React.ReactNode }) => <div className="bg-card border border-border rounded-xl p-6">{children}</div>;

type LoadState =
  | { kind: "sample" }
  | { kind: "no_session" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "unsigned"; sessionId: string }
  | { kind: "recertify"; sessionId: string }
  | { kind: "expired" }
  | {
      kind: "ready";
      sessionId: string;
      data: ChamberData;
      provenance: ProvenanceMap;
      /** Fields an advisor has verified since: settled, so not open items. */
      verified: ReadonlySet<string>;
      submission: ChamberSubmission;
      fileId: string;
      /** The prospect changed their answers after signing: the certification no longer applies. */
      withdrawn: boolean;
    };

const NOT_FOUND = "We couldn't find that packet. The link may be out of date, or it belongs to a different account.";

const ROW_COLUMNS = "id, file_id, chamber_data, field_provenance, submission, status";

/** The advisor-reviewed version of the prospect's certified intake: the final packet, when there is one. */
interface FinalManuscript {
  version: number;
  storage_path: string;
  generated_at: string;
  corrections_applied: number;
}

/**
 * The underwriting packet of one submission. `/manuscript/<File ID>` is the way in once an intake is certified; the
 * older `/manuscript?session=<intake id>` still works. Either way the database's row security decides
 * who can read it (the intake's owner and advisors), so an address alone shows nobody anything, and the
 * page renders the snapshot the certification froze, never the live answers. `demo` renders the fictional
 * sample; the live route never does.
 */
const ManuscriptPage = ({ demo = false }: { demo?: boolean }) => {
  const [downloading, setDownloading] = useState(false);
  const [finalVersion, setFinalVersion] = useState<FinalManuscript | null>(null);
  const [openingFinal, setOpeningFinal] = useState(false);
  const [searchParams] = useSearchParams();
  const { reference } = useParams<{ reference?: string }>();
  const sessionParam = demo ? null : searchParams.get("session");
  const wanted = demo ? null : reference ?? sessionParam;
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<LoadState>(
    wanted ? { kind: "loading" } : { kind: demo ? "sample" : "no_session" },
  );
  // The intake the loaded packet belongs to: named by the File ID in the address, or by ?session=.
  const sessionId = state.kind === "ready" ? state.sessionId : null;

  useEffect(() => {
    if (!wanted) {
      setState({ kind: demo ? "sample" : "no_session" });
      return;
    }
    if (authLoading) return;
    if (!user) {
      setState({ kind: "error", message: "Sign in to view this packet." });
      return;
    }
    // A File ID that isn't one never reaches the database: the answer is the same as for one that isn't yours.
    if (reference && !isFileId(reference)) {
      setState({ kind: "error", message: NOT_FOUND });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    const query = supabase.from("chamber_sessions").select(ROW_COLUMNS);
    (reference ? query.eq("file_id", reference) : query.eq("id", wanted))
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState({ kind: "error", message: NOT_FOUND });
          return;
        }
        const submission = (data.submission as unknown as ChamberSubmission | null) ?? null;
        if (data.status === "expired") {
          setState({ kind: "expired" });
          return;
        }
        if (!submission?.signer_name) {
          setState({ kind: "unsigned", sessionId: data.id });
          return;
        }
        // Answers changed after signing: the database moved the intake back to in progress and withdrew
        // the certification, but the snapshot of what was signed is still stored, so show that, marked
        // as withdrawn. Never the draft. A submission from before snapshots were stored has nothing else
        // to show, so it can only be certified again.
        const withdrawn = data.status !== "submitted";
        const hasSnapshot = submission.chamber_data !== undefined && submission.chamber_data !== null;
        if (withdrawn && !hasSnapshot) {
          setState({ kind: "recertify", sessionId: data.id });
          return;
        }
        // What an advisor has verified since is settled, so it is no open item. When it can't be read, nothing is
        // taken as verified: a field only stays on the prospect's list a little longer.
        const verified = (await readVerifiedFields(data.id)) ?? NO_VERIFIED_FIELDS;
        if (cancelled) return;
        setState({
          kind: "ready",
          sessionId: data.id,
          // Render what was signed, not whatever the session holds now. Without a snapshot the intake is
          // still certified, and the database keeps its saved answers equal to what was signed.
          data: parseChamberData(hasSnapshot ? submission.chamber_data : data.chamber_data),
          // Pair provenance with whichever copy of the data is shown, so it never describes other values.
          provenance: parseProvenance(hasSnapshot ? submission.field_provenance : data.field_provenance),
          verified,
          submission,
          fileId: data.file_id || submission.file_id || "Not assigned",
          withdrawn,
        });
      });
    return () => { cancelled = true; };
  }, [wanted, reference, demo, user, authLoading]);

  // The database offers the latest advisor version only when it was built from this certification.
  const ready = state.kind === "ready";
  // The PEOs and their profiles in use, for a prospect's own packet (signed out, nobody reads a PEO).
  const peoCatalog = usePeoCatalog(ready);
  useEffect(() => {
    setFinalVersion(null);
    if (!ready || !sessionId) return;
    let cancelled = false;
    supabase
      .rpc("prospect_final_manuscript", { p_session_id: sessionId })
      .then(({ data, error }) => {
        if (!cancelled && !error) setFinalVersion((data as FinalManuscript[] | null)?.[0] ?? null);
      });
    return () => { cancelled = true; };
  }, [ready, sessionId]);

  const d = useMemo(() => {
    if (state.kind === "ready") {
      return buildManuscript(state.data, { fileId: state.fileId, submission: state.submission, catalog: peoCatalog.peos, catalogStatus: peoCatalog.status, provenance: state.provenance, verified: state.verified, today: localToday() });
    }
    if (state.kind === "sample") return buildManuscript(DEMO_CHAMBER_DATA, { fileId: SAMPLE_FILE_ID, date: SAMPLE_DATE, provenance: SAMPLE_PROVENANCE });
    return null;
  }, [state, peoCatalog.peos, peoCatalog.status]);

  const isSample = state.kind === "sample";
  const withdrawn = state.kind === "ready" && state.withdrawn;
  // A prospect's own packet runs its eligibility checks against the PEOs' profiles: until they are read, every check
  // would read can't tell, so the PDF waits for them. The sample reads no PEO.
  const catalogPending = state.kind === "ready" && peoCatalog.status !== "ready";
  const backUrl = state.kind === "ready" ? `/start?session=${state.sessionId}` : "/start";

  const handleDownloadPDF = async () => {
    // A withdrawn certification is shown for reference only: no PDF that could be sent on as current.
    if (!d || downloading || withdrawn) return;
    setDownloading(true);
    try {
      // Built from the same data as the page, not a screenshot of it, so the text stays selectable.
      // Sensitive fields stay masked: only an advisor's own workflow can reveal them.
      const pdf = buildManuscriptPdf(d, { revealSensitive: false, sample: isSample });
      downloadBlob(pdf.blob, pdf.filename);
      if (!isSample && sessionId) recordManuscriptDownload(sessionId);
    } catch (err) {
      console.error("Failed to generate manuscript PDF:", err);
      toast.error("We couldn't generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const openFinal = async () => {
    if (!d || !finalVersion || openingFinal) return;
    setOpeningFinal(true);
    try {
      // A link that works for a minute, issued only to this intake's owner (storage checks it).
      // Named as the advisor's own download of that version is (src/components/advisor/ManuscriptPanel.tsx).
      const filename = manuscriptFilename(d.fileId, d.companyName, { version: d.version, date: d.certifiedAt, suffix: `advisor-v${finalVersion.version}` });
      window.location.assign(await finalManuscriptUrl(finalVersion.storage_path, filename));
      // Only once the link was issued: a failed fetch is not a download (the funnel counts the first one for good).
      if (sessionId) recordManuscriptDownload(sessionId);
    } catch (err) {
      console.error("Failed to open the final manuscript:", err);
      toast.error("We couldn't download your final packet. Please try again.");
    } finally {
      setOpeningFinal(false);
    }
  };

  if (state.kind === "loading" || (state.kind !== "sample" && authLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (state.kind === "no_session") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">
            Your packet opens from the Certify &amp; sign tab, once you've reviewed and signed your answers.
          </p>
          <Link to="/start" className="text-primary underline hover:text-primary/90">
            Go to the intake
          </Link>
          <LegalLinks className="mt-8" />
        </div>
      </div>
    );
  }

  if (state.kind === "unsigned") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">
            This packet hasn't been signed yet. Certify your answers on the Certify &amp; sign tab to create it.
          </p>
          <Link to={`/start?session=${state.sessionId}`} className="text-primary underline hover:text-primary/90">
            Back to your intake
          </Link>
          <LegalLinks className="mt-8" />
        </div>
      </div>
    );
  }

  if (state.kind === "expired") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">
            This intake has expired, so it can't be certified or made into a packet anymore. Start a new intake to
            continue.
          </p>
          <Link to="/start" className="text-primary underline hover:text-primary/90">
            Go to the intake
          </Link>
          <LegalLinks className="mt-8" />
        </div>
      </div>
    );
  }

  if (state.kind === "recertify") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">
            Your information changed after you certified it, so that certification no longer applies. Review it and
            certify again on the Certify &amp; sign tab to get an up-to-date packet.
          </p>
          <Link to={`/start?session=${state.sessionId}`} className="text-primary underline hover:text-primary/90">
            Back to your intake
          </Link>
          <LegalLinks className="mt-8" />
        </div>
      </div>
    );
  }

  if (state.kind === "error" || !d) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{state.kind === "error" ? state.message : "Something went wrong."}</p>
          <Link to={user ? "/start" : "/login"} className="text-primary underline hover:text-primary/90">
            {user ? "Go to the intake" : "Sign in"}
          </Link>
          <LegalLinks className="mt-8" />
        </div>
      </div>
    );
  }

  const versionLine = d.version ? `v${d.version}${d.dataVersion ? ` · data version ${d.dataVersion}` : ""}` : isSample ? "Sample" : "Not recorded";

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky actions bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <Link to={backUrl} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {isSample ? "Start your intake" : "Back to Review"}
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">Dates of birth masked</span>
            {!withdrawn && (finalVersion ? (
              <>
                <button onClick={handleDownloadPDF} disabled={downloading || catalogPending}
                  className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  As certified (PDF)
                </button>
                <button onClick={() => void openFinal()} disabled={openingFinal}
                  className="inline-flex items-center gap-2 text-sm whitespace-nowrap bg-primary text-primary-foreground px-3 sm:px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {openingFinal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="sm:hidden">Final PDF</span>
                  <span className="hidden sm:inline">Download the final packet (PDF)</span>
                </button>
              </>
            ) : (
              <button onClick={handleDownloadPDF} disabled={downloading || catalogPending}
                className="inline-flex items-center gap-2 text-sm whitespace-nowrap bg-primary text-primary-foreground px-3 sm:px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60">
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="sm:hidden">Download PDF</span>
                <span className="hidden sm:inline">Download the packet (PDF)</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-6 py-12 space-y-10">
        {isSample && (
          <div className="bg-warning/15 border border-warning/40 rounded-xl p-4 text-sm text-foreground">
            This is a sample packet built from fictional data. Yours is built from your conversation with Lenore.
          </div>
        )}
        {withdrawn && (
          <div role="status" className="bg-warning/15 border border-warning/40 rounded-xl p-4 text-sm text-foreground">
            <p>
              You changed your answers after certifying, so this certification no longer applies. Below is your packet
              exactly as you signed it{d.signer ? ` on ${d.signer.signedAt}` : ""}, for reference. It can't be downloaded.
              Certify again on the Certify &amp; sign tab to get an up-to-date packet.
            </p>
            <Link to={backUrl} className="inline-block mt-2 text-primary underline hover:text-primary/90">
              Back to your intake
            </Link>
          </div>
        )}
        {state.kind === "ready" && !withdrawn && peoCatalog.status === "loading" && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Loading the PEOs' profiles. You can download your packet once they're in.
          </p>
        )}
        {state.kind === "ready" && !withdrawn && peoCatalog.status === "failed" && (
          <div role="alert" className="bg-warning/10 border border-warning/40 rounded-xl p-4 text-sm text-foreground space-y-2">
            <p>We couldn't load the PEOs' profiles, so your packet's eligibility checks can't be run. Try again before downloading.</p>
            <button onClick={peoCatalog.retry} className="min-h-11 text-primary underline hover:text-primary/90">Try again</button>
          </div>
        )}
        {state.kind === "ready" && <ProspectStatusNote sessionId={state.sessionId} />}
        {finalVersion && (
          <div className="bg-success/10 border border-success/40 rounded-xl p-4 text-sm text-foreground" data-testid="final-manuscript">
            <p className="font-medium mb-1">Your final packet is ready.</p>
            <p className="text-muted-foreground">
              A Nevermore advisor reviewed your intake and prepared version {finalVersion.version}
              {finalVersion.corrections_applied > 0
                ? `, with ${finalVersion.corrections_applied} correction${finalVersion.corrections_applied === 1 ? "" : "s"} listed in it`
                : ""}
              . That's the packet to send to your PEO. The page below shows your intake as you certified it, before review.
            </p>
          </div>
        )}

        {/* The certified census as a file, in a PEO's layout when we hold it (#86). Not while withdrawn: nothing
            here may pass as a current certification. */}
        {state.kind === "ready" && !withdrawn && state.data.census.length > 0 && (
          <section aria-labelledby="census-file-heading" className="bg-card border border-border rounded-xl p-5 space-y-2">
            <h2 id="census-file-heading" className="font-display text-lg font-bold">Your census, as a file</h2>
            <p className="text-sm text-muted-foreground">
              Send it with your packet so the PEO's underwriters don't have to re-type it. It's the census you certified.
            </p>
            <CensusDownload census={state.data.census} fileId={state.fileId} peos={listedPeos(peoCatalog.peos).map((p) => p.name)} />
          </section>
        )}

        {/* Each PEO's own questions, as their own file for that PEO alone (L-2.3): the PEO chosen, and any other whose
            questions this certification answers. Never in the packet below, and not while withdrawn. */}
        {state.kind === "ready" && !withdrawn && (() => {
          const certifiedExtra = parseExtraAnswers((state.submission as { extra_answers?: unknown }).extra_answers);
          const peos = supplementPeos(peoCatalog.peos, state.submission.peo ?? null, certifiedExtra);
          if (peos.length === 0) return null;
          return (
            <section aria-labelledby="supplements-heading" className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 id="supplements-heading" className="font-display text-lg font-bold">Your PEOs' own questions</h2>
              <p className="text-sm text-muted-foreground">
                Each PEO's extra questions and your answers are their own file, for that PEO only. They aren't in the packet. Send each one with the packet to its PEO.
              </p>
              {peos.map((p) => (
                <SupplementDownload key={p.id} supplement={buildSupplement({
                  peo: { id: p.id, name: p.name }, questions: p.profile.extraQuestions, certified: certifiedExtra,
                  fileId: state.fileId, version: state.submission.version ?? null, companyName: state.data.company_name ?? "Company not provided",
                })} />
              ))}
            </section>
          );
        })()}

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-8 md:p-10">
          <div className="flex items-start gap-4 mb-8">
            <BrandMark className="w-10 h-10 text-primary flex-shrink-0" />
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{isSample ? "Sample underwriting packet" : "Underwriting packet"}</h1>
              <p className="text-muted-foreground text-sm mt-1">Nevermore · {isSample ? "Fictional data" : withdrawn ? "Certification withdrawn" : "Certified"}</p>
            </div>
          </div>
          <div className="border-t border-border pt-6 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm font-mono">
            {d.submittedTo && (
              <div><span className="text-muted-foreground text-xs block mb-0.5">Prepared for</span>{d.submittedTo}</div>
            )}
            <div><span className="text-muted-foreground text-xs block mb-0.5">Prepared by</span>Nevermore · Lenore</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">{d.signer ? "Certified" : "Date"}</span>{d.date}</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">File ID</span><span className="text-primary">{d.fileId}</span></div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">Version</span>{versionLine}</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">Prospect</span>{d.companyName}</div>
            {!isSample && (
              <div><span className="text-muted-foreground text-xs block mb-0.5">Review</span>As certified, before advisor review</div>
            )}
          </div>
        </div>

        <section>
          <SectionHeader>1 — Company Profile</SectionHeader>
          <Card>{renderRows(d.companyRows, d)}</Card>
        </section>

        <section>
          <SectionHeader>2 — Workforce Summary</SectionHeader>
          <Card>{renderRows(d.workforceRows, d)}</Card>
        </section>

        <section>
          <SectionHeader>3 — Employee Census</SectionHeader>
          {d.census.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
              No employee census captured yet.
            </div>
          ) : (
            <div className="overflow-x-auto bg-card border border-border rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["#", "Name", "DOB", "State", "Title", "Salary", "Type", "Coverage Tier", "Class", "Status"].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.census.map((emp, i) => (
                    <tr key={i} className={`border-b border-border last:border-0 ${emp.flag ? "bg-warning/5" : ""}`}>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{emp.name}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{emp.dob !== NOT_PROVIDED ? maskDob(emp.dob) : emp.dob}</td>
                      <td className="px-3 py-2 font-mono">{emp.state}</td>
                      <td className="px-3 py-2">{emp.title}</td>
                      <td className="px-3 py-2 font-mono">{emp.salary}</td>
                      <td className="px-3 py-2 font-mono">{emp.classification}</td>
                      <td className="px-3 py-2 text-muted-foreground">{emp.tier}</td>
                      <td className="px-3 py-2 font-mono">{emp.classCode}</td>
                      <td className="px-3 py-2">
                        <span title={emp.flag ?? undefined} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          emp.flag ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
                        }`}>
                          {emp.flag ? <><AlertTriangle className="w-3 h-3" /> See note</> : <><CheckCircle className="w-3 h-3" /> ✓</>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <SectionHeader>4 — Dependent Summary</SectionHeader>
          <Card>
            <table className="w-full text-sm">
              <thead><tr className="text-muted-foreground text-left border-b border-border"><th className="pb-2">Tier</th><th className="pb-2 text-right">Employees</th><th className="pb-2 text-right">%</th></tr></thead>
              <tbody>
                {d.dependentTiers.map((dep) => (
                  <tr key={dep.tier} className="border-b border-border last:border-0">
                    <td className="py-2">{dep.tier}</td>
                    <td className="py-2 text-right font-mono">{dep.count}</td>
                    <td className="py-2 text-right font-mono">{dep.pct}</td>
                  </tr>
                ))}
                <tr className="font-bold"><td className="py-2">Total Dependents</td><td className="py-2 text-right font-mono">{d.totalDependents}</td><td /></tr>
              </tbody>
            </table>
          </Card>
          <div className="mt-4 bg-muted border border-border rounded-xl p-4 text-sm">
            <p className="text-muted-foreground">
              ℹ Dependent figures are self-reported. Actual election rates may vary at open enrollment.
            </p>
          </div>
        </section>

        <section>
          <SectionHeader>5 — Locations</SectionHeader>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>{renderRows(d.locationRows, d)}</Card>
            <Card>
              <p className="text-xs font-medium text-muted-foreground mb-3">State breakdown</p>
              {d.states.length === 0 ? (
                <p className="text-sm text-muted-foreground">No states captured yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-muted-foreground text-left"><th className="pb-2">State</th><th className="pb-2">Employees</th><th className="pb-2">W/C System</th></tr></thead>
                  <tbody>
                    {d.states.map((s) => (
                      <tr key={s.state} className="border-t border-border">
                        <td className="py-2 font-mono">{s.state}</td>
                        <td className="py-2 font-mono">{s.count}</td>
                        <td className="py-2 font-mono text-xs">{s.system}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </section>

        <section>
          <SectionHeader>6 — Payroll &amp; Time</SectionHeader>
          <Card>{renderRows(d.payrollRows, d)}</Card>
        </section>

        <section>
          <SectionHeader>7 — Current Benefits</SectionHeader>
          <Card>{renderRows(d.benefitsRows, d)}</Card>
        </section>

        <section>
          <SectionHeader>8 — Workers' Compensation</SectionHeader>
          <Card>{renderRows(d.workersCompRows, d)}</Card>
        </section>

        <section>
          <SectionHeader>9 — Operations &amp; HR</SectionHeader>
          <Card>{renderRows(d.operationsRows, d)}</Card>
        </section>

        <section>
          <SectionHeader>10 — Documents</SectionHeader>
          <Card>
            {d.documents === null ? (
              <p className="text-sm text-muted-foreground">{isSample ? "No documents in the sample." : "Documents were not recorded with this certification."}</p>
            ) : d.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents were uploaded with this submission.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-muted-foreground text-left border-b border-border"><th className="pb-2">Document</th><th className="pb-2">Kind</th><th className="pb-2">Status</th></tr></thead>
                <tbody>
                  {d.documents.map((doc, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2">{doc.name}</td>
                      <td className="py-2 text-muted-foreground">{doc.category}</td>
                      <td className="py-2 text-muted-foreground">{doc.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </section>

        <section>
          <SectionHeader>11 — Underwriting Readiness</SectionHeader>
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <p className="text-xs font-medium text-muted-foreground mb-4">Confirmed</p>
            {d.resolved.length === 0 && <p className="text-sm text-muted-foreground">Nothing confirmed yet.</p>}
            {d.resolved.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <span className="text-foreground text-sm">{item}</span>
              </div>
            ))}
            <p className="text-xs font-medium text-muted-foreground pt-4">Eligibility checks</p>
            {d.peoChecks === "loading" && (
              <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" aria-hidden="true" />
                Loading {d.checkedPeo}'s profile to run its eligibility checks.
              </p>
            )}
            {d.peoChecks === "failed" && (
              <p className="flex items-start gap-2.5 text-sm text-warning">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                We couldn't load {d.checkedPeo}'s profile, so its eligibility checks can't be run yet. Try again at the top of the packet.
              </p>
            )}
            {d.checks.map((c) => (
              <div key={c.label} className="flex items-start gap-2.5">
                <FitIcon status={CHECK_OUTCOME[c.status]} />
                {c.ofPeoRule ? (
                  // A check against the PEO's rules: its outcome in words and when the rule was checked.
                  <span className={`text-sm ${c.status === "unknown" ? "text-muted-foreground" : "text-foreground"}`}>
                    {c.label}{" "}
                    <span className={c.status === "fail" ? "text-warning" : undefined}>{FIT_WORDS[CHECK_OUTCOME[c.status]]}</span>
                    {c.checkedOn && (
                      <span className={c.stale ? "text-warning" : "text-muted-foreground"}>{` · ${checkedLine(c.checkedOn, !!c.stale)}`}</span>
                    )}
                  </span>
                ) : (
                  <span className={`text-sm ${c.status === "unknown" ? "text-muted-foreground" : "text-foreground"}`}>
                    {c.label}{c.status === "unknown" && " — not yet verified"}{c.status === "fail" && " — not met"}
                  </span>
                )}
              </div>
            ))}
            {d.checks.some((c) => c.status === "fail") && <p className="text-xs text-warning">{NOT_MET_NOTE}</p>}
            {d.checksNote && (
              <p className="flex items-start gap-2.5 text-sm text-warning">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {d.checksNote}
              </p>
            )}
            {d.open.length > 0 && (
              <div className="mt-4 bg-warning/10 border border-warning/30 rounded-lg p-4 space-y-2">
                <p className="text-warning text-xs font-medium mb-1">Open items</p>
                {d.open.map((item) => (
                  <p key={item} className="text-foreground text-sm flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
                    {item}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Section 12 — Certification */}
        <section>
          <div className="bg-card border border-primary/40 rounded-xl overflow-hidden">
            <div className="h-1.5 bg-primary" />
            <div className="p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <BrandMark className="w-8 h-8 text-primary" />
                <div>
                  <Wordmark className="block text-lg" />
                  <p className="text-muted-foreground text-xs">Certification</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-8">
                Authorized representative of {d.companyName} has reviewed and confirmed accuracy of this submission
                through Edgar Allan Advisory's intake process.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm mb-8">
                <div><span className="text-muted-foreground text-xs">Name</span><br /><span className="font-mono">{d.signer?.name || "[Full Name]"}</span></div>
                <div><span className="text-muted-foreground text-xs">Role</span><br /><span className="font-mono">{d.signer?.title || "[Role]"}</span></div>
                <div><span className="text-muted-foreground text-xs">Company</span><br /><span className="font-mono">{d.companyName}</span></div>
                <div><span className="text-muted-foreground text-xs">Signed</span><br /><span className="font-mono">{d.signer?.signedAtFull ?? "—"}</span></div>
                <div><span className="text-muted-foreground text-xs">File ID</span><br /><span className="font-mono text-primary">{d.fileId}</span></div>
                <div><span className="text-muted-foreground text-xs">Certification</span><br /><span className="font-mono">{versionLine}</span></div>
              </div>
              <div className="relative overflow-hidden border border-border rounded-lg p-4 mb-8">
                {/* Wording counsel hasn't approved is marked where it is printed, as the PDF marks it (C-2.4). */}
                {d.signer?.consentDraft && (
                  <>
                    <div aria-hidden="true" data-testid="consent-draft-watermark" className="pointer-events-none select-none absolute inset-0 flex items-center justify-center">
                      <span className="font-display font-bold text-6xl md:text-8xl tracking-[0.3em] text-warning/15 -rotate-[18deg]">DRAFT</span>
                    </div>
                    <p className="relative text-xs font-mono font-medium text-warning mb-3">
                      Consent wording {d.signer.consentVersion ?? "not recorded"} · {CONSENT_DRAFT_LABEL}
                    </p>
                  </>
                )}
                <p className="relative text-foreground text-sm italic whitespace-pre-line">
                  {d.signer ? d.signer.consent : "I confirm the information in this submission is accurate and complete to the best of my knowledge."}
                </p>
                <div className="relative mt-4 flex gap-8 text-sm text-muted-foreground">
                  {d.signer ? (
                    <span>Signed electronically by {d.signer.name} on {d.signer.signedAtFull}</span>
                  ) : (
                    <>
                      <span>Signed: ________________________</span>
                      <span>Date: _______________</span>
                    </>
                  )}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Prepared by: Edgar Allan Advisory · {SITE_DOMAIN}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Data note: Information collected here constitutes employer HR records,
                  not Protected Health Information under HIPAA. PHI protections apply
                  upon enrollment submission to a health plan carrier.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer on every page */}
        <div className="text-center border-t border-border pt-6 text-xs text-muted-foreground">
          <p>Nevermore · {d.fileId} · {versionLine} · {d.companyName} · {d.date}</p>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center py-8">
          {!withdrawn && (finalVersion ? (
            <button onClick={() => void openFinal()} disabled={openingFinal}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
              {openingFinal ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} Download the final packet (PDF)
            </button>
          ) : (
            <button onClick={handleDownloadPDF} disabled={downloading || catalogPending}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
              {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} Download the packet (PDF)
            </button>
          ))}
          <Link to={backUrl}
            className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" /> {isSample ? "Start your intake" : "Back to Review"}
          </Link>
        </div>

        {/* The site's legal links: part of the page, not the packet (the PDF is built separately). */}
        <LegalLinks className="text-center pb-8" />
      </div>
    </div>
  );
};

export default ManuscriptPage;
