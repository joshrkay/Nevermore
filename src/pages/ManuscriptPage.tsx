import { useEffect, useMemo, useState } from "react";
import { RavenIcon } from "@/components/RavenLogo";
import { CheckCircle, AlertTriangle, Download, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ChamberData } from "@/data/chamberTypes";
import { parseChamberData } from "@/data/chamberValidation";
import { buildManuscript, fileIdForSession, maskDob, NOT_PROVIDED, type ChamberSubmission } from "@/data/manuscript";
import { buildManuscriptPdf } from "@/lib/manuscriptPdf";
import { downloadBlob } from "@/lib/downloadFile";

const SAMPLE_FILE_ID = "EAA-SAMPLE";

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-display text-lg font-bold mb-4 pl-4 border-l-4 border-primary">{children}</h3>
);

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-border last:border-0">
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className="font-mono text-sm text-foreground text-right">{value}</span>
  </div>
);

type LoadState =
  | { kind: "sample" }
  | { kind: "no_session" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "unsigned" }
  | { kind: "recertify" }
  | { kind: "ready"; data: ChamberData; submission: ChamberSubmission | null; fileId: string };

// `demo` renders the fictional sample; the live route never does.
const ManuscriptPage = ({ demo = false }: { demo?: boolean }) => {
  // Sensitive fields stay masked, on screen and in the PDF, until the signed-in owner reveals them.
  const [showMasked, setShowMasked] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [searchParams] = useSearchParams();
  const sessionId = demo ? null : searchParams.get("session");
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<LoadState>(
    sessionId ? { kind: "loading" } : { kind: demo ? "sample" : "no_session" },
  );

  useEffect(() => {
    if (!sessionId) {
      setState({ kind: demo ? "sample" : "no_session" });
      return;
    }
    if (authLoading) return;
    if (!user) {
      setState({ kind: "error", message: "Sign in to view this manuscript." });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    supabase
      .from("chamber_sessions")
      .select("chamber_data, submission, status, created_at")
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState({ kind: "error", message: "We couldn't find that Manuscript. The link may be out of date, or it belongs to a different account." });
          return;
        }
        const submission = (data.submission as unknown as ChamberSubmission | null) ?? null;
        // Only a signed submission becomes a certified manuscript. A signed one whose status
        // moved back means the information changed after certification.
        if (data.status !== "submitted" && submission?.signer_name) {
          setState({ kind: "recertify" });
          return;
        }
        if (data.status !== "submitted" || !submission?.signer_name) {
          setState({ kind: "unsigned" });
          return;
        }
        setState({
          kind: "ready",
          // Render what was signed, not whatever the session holds now.
          data: parseChamberData(submission.chamber_data ?? data.chamber_data),
          submission,
          fileId: submission.file_id || fileIdForSession(sessionId, new Date(data.created_at)),
        });
      });
    return () => { cancelled = true; };
  }, [sessionId, demo, user, authLoading]);

  const d = useMemo(() => {
    if (state.kind === "ready") return buildManuscript(state.data, { fileId: state.fileId, submission: state.submission });
    if (state.kind === "sample") return buildManuscript(DEMO_CHAMBER_DATA, { fileId: SAMPLE_FILE_ID });
    return null;
  }, [state]);

  const isSample = state.kind === "sample";
  const backUrl = state.kind === "ready" && sessionId ? `/start?session=${sessionId}` : "/start";

  const handleDownloadPDF = async () => {
    if (!d || downloading) return;
    setDownloading(true);
    try {
      // Built from the same data as the page, not a screenshot of it, so the text stays selectable.
      const pdf = buildManuscriptPdf(d, { revealSensitive: !showMasked, sample: isSample });
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
          <Link to={`/start?session=${sessionId}`} className="text-primary underline hover:text-primary/90">
            Back to The Chamber
          </Link>
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
          <Link to={`/start?session=${sessionId}`} className="text-primary underline hover:text-primary/90">
            Back to The Chamber
          </Link>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky actions bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <Link to={backUrl} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {isSample ? "Start Yours" : "Back to Review"}
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowMasked(!showMasked)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
              {showMasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showMasked ? "Data masked" : "Data visible"}
            </button>
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

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-8 md:p-10">
          <div className="flex items-start gap-4 mb-8">
            <RavenIcon className="w-10 h-10 text-primary flex-shrink-0" />
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">THE MANUSCRIPT</h1>
              <p className="text-muted-foreground text-sm mt-1">Edgar Allan Advisory · {isSample ? "Sample" : "Certified"} Submission</p>
            </div>
          </div>
          <div className="border-t border-border pt-6 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm font-mono">
            {d.submittedTo && (
              <div><span className="text-muted-foreground text-xs block mb-0.5">SUBMITTED TO</span>{d.submittedTo} — Underwriting</div>
            )}
            <div><span className="text-muted-foreground text-xs block mb-0.5">PREPARED BY</span>Edgar Allan Advisory · Lenore</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">DATE</span>{d.date}</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">FILE ID</span><span className="text-primary">{d.fileId}</span></div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">PROSPECT</span>{d.companyName}</div>
          </div>
        </div>

        {/* Section 1 — Company Profile */}
        <section>
          <SectionHeader>1 — Company Profile</SectionHeader>
          <div className="bg-card border border-border rounded-xl p-6">
            {d.companyRows.map(([k, v]) => <DataRow key={k} label={k} value={v} />)}
          </div>
        </section>

        {/* Section 2 — Workforce Summary */}
        <section>
          <SectionHeader>2 — Workforce Summary</SectionHeader>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              {d.workforceRows.map(([k, v]) => <DataRow key={k} label={k} value={v} />)}
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
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
            </div>
          </div>
        </section>

        {/* Section 3 — Employee Census */}
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
                    {["#", "Name", "DOB", "State", "Title", "Salary", "Type", "Coverage Tier", "Status"].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.census.map((emp, i) => (
                    <tr key={i} className={`border-b border-border last:border-0 ${emp.flag ? "bg-warning/5" : ""}`}>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{emp.name}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{showMasked && emp.dob !== NOT_PROVIDED ? maskDob(emp.dob) : emp.dob}</td>
                      <td className="px-3 py-2 font-mono">{emp.state}</td>
                      <td className="px-3 py-2">{emp.title}</td>
                      <td className="px-3 py-2 font-mono">{emp.salary}</td>
                      <td className="px-3 py-2 font-mono">{emp.classification}</td>
                      <td className="px-3 py-2 text-muted-foreground">{emp.tier}</td>
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

        {/* Section 4 — Dependent Summary */}
        <section>
          <SectionHeader>4 — Dependent Summary</SectionHeader>
          <div className="bg-card border border-border rounded-xl p-6">
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
          </div>
          <div className="mt-4 bg-muted border border-border rounded-xl p-4 text-sm">
            <p className="text-muted-foreground">
              ℹ Dependent figures are self-reported. Actual election rates may vary at open enrollment.
            </p>
          </div>
        </section>

        {/* Section 5 — Benefits */}
        <section>
          <SectionHeader>5 — Current Benefits</SectionHeader>
          <div className="bg-card border border-border rounded-xl p-6">
            {d.benefitsRows.map(([k, v]) => <DataRow key={k} label={k} value={v} />)}
          </div>
        </section>

        {/* Section 6 — Status */}
        <section>
          <SectionHeader>6 — Underwriting Readiness</SectionHeader>
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Confirmed</p>
            {d.resolved.length === 0 && <p className="text-sm text-muted-foreground">Nothing confirmed yet.</p>}
            {d.resolved.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <span className="text-foreground text-sm">{item}</span>
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

        {/* Section 7 — Certification */}
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
          <p>Edgar Allan Advisory · {d.fileId} · {d.companyName} · {d.date}</p>
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
      </div>
    </div>
  );
};

export default ManuscriptPage;
