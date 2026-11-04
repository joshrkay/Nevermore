import { useEffect, useMemo, useState } from "react";
import { RavenIcon } from "@/components/RavenLogo";
import { CheckCircle, AlertTriangle, Download, HelpCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ChamberData } from "@/data/chamberTypes";
import { parseChamberData } from "@/data/chamberValidation";
import { buildManuscript, isFileId, maskDob, NOT_PROVIDED, rowProvenance, type ChamberSubmission, type ManuscriptRow } from "@/data/manuscript";
import { describeSource, parseProvenance, STATUS_LABELS, type FieldKey, type FieldProvenance, type ProvenanceMap } from "@/data/provenance";
import { buildManuscriptPdf } from "@/lib/manuscriptPdf";
import { fetchVerifiedFields } from "@/lib/verifiedFields";
import { downloadBlob } from "@/lib/downloadFile";
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

// Shows whether a value was confirmed or only inferred, and where it came from.
const DataRow = ({ label, value, provenance }: { label: string; value: string; provenance?: FieldProvenance }) => (
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
    {showsStatus(value, provenance) && (
      <p className="text-[11px] text-muted-foreground text-right mt-0.5">{describeSource(provenance.source)}</p>
    )}
  </div>
);

const renderRows = (rows: ManuscriptRow[], provenance: ProvenanceMap) =>
  rows.map((row) => <DataRow key={row[0]} label={row[0]} value={row[1]} provenance={rowProvenance(row, provenance)} />);

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
    };

const NOT_FOUND = "We couldn't find that Manuscript. The link may be out of date, or it belongs to a different account.";

const ROW_COLUMNS = "id, file_id, chamber_data, field_provenance, submission, status";

/**
 * The Manuscript of one submission. `/manuscript/<File ID>` is the way in once an intake is certified; the
 * older `/manuscript?session=<intake id>` still works. Either way the database's row security decides
 * who can read it (the intake's owner and advisors), so an address alone shows nobody anything, and the
 * page renders the snapshot the certification froze, never the live answers. `demo` renders the fictional
 * sample; the live route never does.
 */
const ManuscriptPage = ({ demo = false }: { demo?: boolean }) => {
  const [downloading, setDownloading] = useState(false);
  const [searchParams] = useSearchParams();
  const { reference } = useParams<{ reference?: string }>();
  const sessionParam = demo ? null : searchParams.get("session");
  const wanted = demo ? null : reference ?? sessionParam;
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<LoadState>(
    wanted ? { kind: "loading" } : { kind: demo ? "sample" : "no_session" },
  );

  useEffect(() => {
    if (!wanted) {
      setState({ kind: demo ? "sample" : "no_session" });
      return;
    }
    if (authLoading) return;
    if (!user) {
      setState({ kind: "error", message: "Sign in to view this manuscript." });
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
        // Only a signed submission becomes a certified manuscript. A signed one whose status
        // moved back means the information changed after certification.
        if (data.status !== "submitted" && submission?.signer_name) {
          setState({ kind: "recertify", sessionId: data.id });
          return;
        }
        if (data.status !== "submitted" || !submission?.signer_name) {
          setState({ kind: "unsigned", sessionId: data.id });
          return;
        }
        // What an advisor has verified since is settled, so it is no open item (never an error if unreadable).
        const verified = await fetchVerifiedFields(data.id);
        if (cancelled) return;
        setState({
          kind: "ready",
          sessionId: data.id,
          // Render what was signed, not whatever the session holds now.
          data: parseChamberData(submission.chamber_data ?? data.chamber_data),
          // Pair provenance with whichever copy of the data is shown, so it never describes other values.
          provenance: parseProvenance(submission.chamber_data ? submission.field_provenance : data.field_provenance),
          verified,
          submission,
          fileId: data.file_id || submission.file_id || "Not assigned",
        });
      });
    return () => { cancelled = true; };
  }, [wanted, reference, demo, user, authLoading]);

  const d = useMemo(() => {
    if (state.kind === "ready") {
      return buildManuscript(state.data, { fileId: state.fileId, submission: state.submission, provenance: state.provenance, verified: state.verified });
    }
    if (state.kind === "sample") return buildManuscript(DEMO_CHAMBER_DATA, { fileId: SAMPLE_FILE_ID, date: SAMPLE_DATE, provenance: SAMPLE_PROVENANCE });
    return null;
  }, [state]);

  const isSample = state.kind === "sample";
  const backUrl = state.kind === "ready" ? `/start?session=${state.sessionId}` : "/start";

  const handleDownloadPDF = async () => {
    if (!d || downloading) return;
    setDownloading(true);
    try {
      // Built from the same data as the page, not a screenshot of it, so the text stays selectable.
      // Sensitive fields stay masked: only an advisor's own workflow can reveal them.
      const pdf = buildManuscriptPdf(d, { revealSensitive: false, sample: isSample });
      downloadBlob(pdf.blob, pdf.filename);
    } catch (err) {
      console.error("Failed to generate manuscript PDF:", err);
      toast.error("We couldn't generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
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
            Open your Manuscript from The Reckoning, once you've reviewed and signed your submission.
          </p>
          <Link to="/start" className="text-primary underline hover:text-primary/90">
            Go to The Chamber
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
            This manuscript hasn't been signed yet. Complete The Reckoning to certify and generate it.
          </p>
          <Link to={`/start?session=${state.sessionId}`} className="text-primary underline hover:text-primary/90">
            Back to The Chamber
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
            This intake has expired, so it can no longer be certified or made into a Manuscript. Start a new intake
            in The Chamber to continue.
          </p>
          <Link to="/start" className="text-primary underline hover:text-primary/90">
            Go to The Chamber
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
            certify again in The Reckoning to get an up-to-date Manuscript.
          </p>
          <Link to={`/start?session=${state.sessionId}`} className="text-primary underline hover:text-primary/90">
            Back to The Chamber
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
            {user ? "Go to The Chamber" : "Sign in"}
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
            <ArrowLeft className="w-4 h-4" /> {isSample ? "Start Yours" : "Back to Review"}
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">Dates of birth masked</span>
            <button onClick={handleDownloadPDF} disabled={downloading}
              className="inline-flex items-center gap-2 text-sm whitespace-nowrap bg-primary text-primary-foreground px-3 sm:px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="sm:hidden">Download PDF</span>
              <span className="hidden sm:inline">Download The Manuscript (PDF)</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-6 py-12 space-y-10">
        {isSample && (
          <div className="bg-warning/15 border border-warning/40 rounded-xl p-4 text-sm text-foreground">
            🪶 This is a sample manuscript built from fictional data. Yours is generated from your conversation with Lenore.
          </div>
        )}
        {state.kind === "ready" && <ProspectStatusNote sessionId={state.sessionId} />}

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-8 md:p-10">
          <div className="flex items-start gap-4 mb-8">
            <RavenIcon className="w-10 h-10 text-primary flex-shrink-0" />
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">THE MANUSCRIPT</h1>
              <p className="text-muted-foreground text-sm mt-1">Edgar Allan Advisory · {isSample ? "Sample" : "Certified"} Underwriting Packet</p>
            </div>
          </div>
          <div className="border-t border-border pt-6 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm font-mono">
            {d.submittedTo && (
              <div><span className="text-muted-foreground text-xs block mb-0.5">PREPARED FOR</span>{d.submittedTo}</div>
            )}
            <div><span className="text-muted-foreground text-xs block mb-0.5">PREPARED BY</span>Edgar Allan Advisory · Lenore</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">{d.signer ? "CERTIFIED" : "DATE"}</span>{d.date}</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">FILE ID</span><span className="text-primary">{d.fileId}</span></div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">VERSION</span>{versionLine}</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">PROSPECT</span>{d.companyName}</div>
          </div>
        </div>

        <section>
          <SectionHeader>1 — Company Profile</SectionHeader>
          <Card>{renderRows(d.companyRows, d.provenance)}</Card>
        </section>

        <section>
          <SectionHeader>2 — Workforce Summary</SectionHeader>
          <Card>{renderRows(d.workforceRows, d.provenance)}</Card>
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
            <Card>{renderRows(d.locationRows, d.provenance)}</Card>
            <Card>
              <p className="text-xs text-muted-foreground font-mono mb-3">STATE BREAKDOWN</p>
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
          <Card>{renderRows(d.payrollRows, d.provenance)}</Card>
        </section>

        <section>
          <SectionHeader>7 — Current Benefits</SectionHeader>
          <Card>{renderRows(d.benefitsRows, d.provenance)}</Card>
        </section>

        <section>
          <SectionHeader>8 — Workers' Compensation</SectionHeader>
          <Card>{renderRows(d.workersCompRows, d.provenance)}</Card>
        </section>

        <section>
          <SectionHeader>9 — Operations &amp; HR</SectionHeader>
          <Card>{renderRows(d.operationsRows, d.provenance)}</Card>
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
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Confirmed</p>
            {d.resolved.length === 0 && <p className="text-sm text-muted-foreground">Nothing confirmed yet.</p>}
            {d.resolved.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <span className="text-foreground text-sm">{item}</span>
              </div>
            ))}
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider pt-4">Eligibility checks</p>
            {d.checks.map((c) => (
              <div key={c.label} className="flex items-start gap-2.5">
                {c.status === "pass" && <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />}
                {c.status === "fail" && <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />}
                {c.status === "unknown" && <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                <span className={`text-sm ${c.status === "unknown" ? "text-muted-foreground" : "text-foreground"}`}>
                  {c.label}{c.status === "unknown" && " — not yet verified"}{c.status === "fail" && " — not met"}
                </span>
              </div>
            ))}
            {d.open.length > 0 && (
              <div className="mt-4 bg-warning/10 border border-warning/30 rounded-lg p-4 space-y-2">
                <p className="text-warning text-xs font-medium mb-1">OPEN ITEMS:</p>
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
          <div className="bg-[hsl(230,25%,8%)] border border-primary/40 rounded-xl overflow-hidden">
            <div className="h-1.5 bg-primary" />
            <div className="p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <RavenIcon className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-display font-bold text-foreground text-lg">EDGAR ALLAN ADVISORY</p>
                  <p className="text-muted-foreground text-xs font-mono">SUBMISSION CERTIFICATION</p>
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
              <div className="border border-border rounded-lg p-4 mb-8">
                <p className="text-foreground text-sm italic whitespace-pre-line">
                  {d.signer ? d.signer.consent : "I confirm the information in this submission is accurate and complete to the best of my knowledge."}
                </p>
                <div className="mt-4 flex gap-8 text-sm text-muted-foreground">
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
                  Prepared by: Edgar Allan Advisory · edgar-allan-advisory.lovable.app
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
          <p>Edgar Allan Advisory · {d.fileId} · {versionLine} · {d.companyName} · {d.date}</p>
          <p className="font-display italic mt-1">"Nevermore will HR slow you down."</p>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center py-8">
          <button onClick={handleDownloadPDF} disabled={downloading}
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
            {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} Download The Manuscript (PDF)
          </button>
          <Link to={backUrl}
            className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" /> {isSample ? "Start Yours" : "Back to Review"}
          </Link>
        </div>

        {/* The site's legal links: part of the page, not the packet (the PDF is built separately). */}
        <LegalLinks className="text-center pb-8" />
      </div>
    </div>
  );
};

export default ManuscriptPage;
