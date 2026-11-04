import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RavenIcon } from "../RavenLogo";
import { AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { ChamberData } from "@/data/chamberTypes";
import { manuscriptPath, NO_CERTIFICATION, type CertificationState, type ChamberSubmission } from "@/data/manuscript";
import {
  CONSENT_IS_DRAFT,
  CONSENT_SIGNING_STATEMENT,
  CONSENT_TEXT_VERSION,
  certificationBlockers,
  consentStatements,
  type NeededAnswer,
} from "@/data/certification";
import { useAuth } from "@/hooks/useAuth";
import { blockingItems } from "@/data/readiness";
import { NO_VERIFIED_FIELDS } from "@/data/requiredItems";
import type { ProvenanceMap } from "@/data/provenance";
import type { SubmitFailure } from "@/hooks/useChamberSession";
import VerifyEmailGate from "./VerifyEmailGate";

interface ReckoningTabProps {
  data: ChamberData;
  /** Status and source of each answer: a required answer given two ways blocks certifying (B-2, D26). */
  provenance?: ProvenanceMap;
  /** Fields an advisor verified: settled whatever their status. */
  verified?: ReadonlySet<string>;
  /** The PEO the packet is prepared for, if the prospect chose one. */
  peoName: string | null;
  sessionId: string | null;
  /** The intake's File ID, assigned by the database at its first certification; null until then. */
  fileId: string | null;
  /**
   * `signedDataKey` is the answers as signed; the save is refused if they have moved on. Resolves
   * `true` once certified, otherwise `false` or the reason, in words for the prospect.
   */
  onSubmit: (submission: ChamberSubmission, signedDataKey: string) => Promise<boolean | SubmitFailure>;
  /** Whether this intake is already certified, or was changed after it was. */
  certification?: CertificationState;
  /** Opens the Review step, where the missing answers can be added. */
  onReview?: () => void;
}

const formatSigned = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

const GENERIC_FAILURE = "We couldn't save your submission. Please try again.";

const ReckoningTab = ({ data, provenance = {}, verified = NO_VERIFIED_FIELDS, peoName: chosenPeo, sessionId, fileId, onSubmit, certification = NO_CERTIFICATION, onReview }: ReckoningTabProps) => {
  const peoName = chosenPeo ?? "your PEO";
  const { isAnonymous } = useAuth();
  // A returning signer doesn't retype their name and role to certify again.
  const previous = certification.status === "none" ? null : certification.submission;
  const [checks, setChecks] = useState([false, false, false]);
  const [signerName, setSignerName] = useState(previous?.signer_name ?? "");
  const [signerTitle, setSignerTitle] = useState(previous?.signer_title ?? "");
  const [signedAt, setSignedAt] = useState<Date | null>(null);
  // The data as it stood when signed; if it moves on, the signature no longer covers it.
  const [signedDataKey, setSignedDataKey] = useState<string | null>(null);
  const [needsRecertify, setNeedsRecertify] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Why the last attempt didn't go through, kept on screen until the next attempt or a change.
  const [failure, setFailure] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ name: string; title: string; at: Date } | null>(null);
  // A second click while the first is still saving must not send a second certification.
  const submittingRef = useRef(false);

  const attestations = consentStatements(chosenPeo);
  const dataKey = useMemo(() => JSON.stringify(data), [data]);
  // What the answers are now, for checking after a save that they are still the ones that were signed.
  const dataKeyRef = useRef(dataKey);
  dataKeyRef.current = dataKey;

  // Any change after signing (an edit in a tab, or Lenore updating a field) voids the signature,
  // even after a successful submit: the prospect certified the earlier version, not this one.
  // The database withdraws the saved certification for the same reason.
  useEffect(() => {
    if (signedDataKey === null || signedDataKey === dataKey) return;
    setSignedAt(null);
    setSignedDataKey(null);
    setChecks([false, false, false]);
    setSubmitted(null);
    setFailure(null);
    setNeedsRecertify(true);
  }, [dataKey, signedDataKey]);

  const signed = signedAt !== null;
  // The required answers that are missing, or given two ways (one list, shared with Review).
  const needed = blockingItems(data, provenance, verified);
  const missingAnswers = needed.filter((item) => item.reason === "missing");
  const conflictingAnswers = needed.filter((item) => item.reason !== "missing");
  const blockers = certificationBlockers({
    acknowledged: checks,
    signer: { name: signerName, title: signerTitle },
    signed,
    hasIntake: !!sessionId,
    isGuest: isAnonymous,
    needed: needed.map((item) => ({ label: item.label, reason: item.reason as NeededAnswer["reason"] })),
  });
  const allChecked = blockers.length === 0;
  const recordedFileId = fileId ?? (certification.status === "none" ? null : certification.submission.file_id) ?? null;
  const manuscriptUrl = manuscriptPath(recordedFileId, sessionId);
  // A certification that still covers these answers is final: offering the form again would let a
  // second signature replace it (and move the intake in the advisor queue) with nothing new certified.
  // The Manuscript names the PEO stored in the certification, and choosing a different PEO leaves the
  // answers untouched. So a PEO chosen this visit that differs from the certified one needs certifying
  // again. Nothing chosen yet (a fresh visit) keeps the certified one.
  const certifiedPeo = certification.status === "certified" ? certification.submission.peo : undefined;
  const peoChanged = certification.status === "certified" && chosenPeo !== null && chosenPeo !== certifiedPeo;
  const certifiedAndCurrent = certification.status === "certified" && !needsRecertify && !peoChanged;

  const handleSign = () => {
    if (!checks.every(Boolean)) {
      toast.error("Check every statement before you sign.");
      return;
    }
    if (!signerName.trim()) {
      toast.error("Type your full name to sign.");
      return;
    }
    if (!signerTitle.trim()) {
      toast.error("Enter your role at the company to sign.");
      return;
    }
    setSignedAt(new Date());
    setSignedDataKey(dataKey);
    setNeedsRecertify(false);
    setFailure(null);
  };

  const handleSubmit = async () => {
    if (!allChecked || !signedAt || signedDataKey !== dataKey || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFailure(null);
    const submission: ChamberSubmission = {
      signer_name: signerName.trim(),
      signer_title: signerTitle.trim(),
      signed_at: signedAt.toISOString(),
      // The database assigns the File ID at the first certification and keeps it; what is sent here is
      // the one already on record, or nothing.
      file_id: recordedFileId ?? "",
      consent_text_version: CONSENT_TEXT_VERSION,
      // Same version under the name the database's certification check reads.
      consent_version: CONSENT_TEXT_VERSION,
      consent_text: [...attestations, CONSENT_SIGNING_STATEMENT],
      ...(chosenPeo ? { peo: chosenPeo } : {}),
    };
    const signedKey = dataKey;
    let result: boolean | SubmitFailure;
    try {
      result = await onSubmit(submission, signedKey);
    } catch (error) {
      console.error("Failed to submit session:", error);
      result = false;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    // The answers can change while the save is pending. The effect above has then already voided
    // the signature, so don't report a certification of answers that were not signed.
    if (dataKeyRef.current !== signedKey) {
      toast.error("Your information changed while we were saving. Review it and certify again.");
      return;
    }
    if (result === true) {
      setSubmitted({ name: signerName.trim(), title: signerTitle.trim(), at: signedAt });
      toast.success("Your certification was recorded and your submission is saved.");
    } else {
      const message = typeof result === "object" ? result.message : GENERIC_FAILURE;
      setFailure(message);
      toast.error(message);
    }
  };

  return (
    <>
      <div className="p-6 space-y-8">
        <div>
          <h2 className="font-display text-3xl font-bold mb-2">The Reckoning</h2>
          <p className="text-muted-foreground text-sm">
            Confirm what you've shared before The Manuscript is prepared for {peoName}.
          </p>
        </div>

        {/* The Manuscript can't be generated without these; the database refuses the certification too. */}
        {needed.length > 0 && !certifiedAndCurrent && (
          <div role="alert" aria-label="Answers still needed" className="border border-destructive/40 bg-destructive/5 rounded-xl p-4 text-sm space-y-2">
            {missingAnswers.length > 0 && (
              <>
                <p className="font-medium">Before The Manuscript can be generated, add:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {missingAnswers.map((item) => (
                    <li key={item.key}>
                      {item.label} <span className="text-muted-foreground text-xs">{item.action}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {conflictingAnswers.length > 0 && (
              <>
                <p className="font-medium">
                  {missingAnswers.length > 0 ? "And choose one answer for:" : "Before The Manuscript can be generated, choose one answer for:"}
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {conflictingAnswers.map((item) => (
                    <li key={item.key}>
                      {item.label} <span className="text-muted-foreground text-xs">{item.action}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {onReview && (
              <button type="button" onClick={onReview} className="text-sm font-medium text-primary underline underline-offset-2">
                Go to Review
              </button>
            )}
          </div>
        )}

        {/* What's already on record for this intake */}
        {certification.status === "certified" && !needsRecertify && !peoChanged && !submitted && (
          <div role="status" className="border border-success/40 bg-success/5 rounded-xl p-4 text-sm">
            Certified by {certification.submission.signer_name}, {certification.submission.signer_title}, on{" "}
            {formatSigned(certification.submission.signed_at)}. File ID: {certification.submission.file_id}
            {certification.submission.version ? ` (version ${certification.submission.version})` : ""}.{" "}
            <Link to={manuscriptUrl} className="underline">View The Manuscript</Link>
          </div>
        )}
        {peoChanged && !needsRecertify && !submitted && (
          <div role="status" className="border border-primary/40 bg-primary/5 rounded-xl p-4 text-sm">
            {certifiedPeo ? `You certified for ${certifiedPeo}` : "You certified before choosing a PEO"}, and you've since
            chosen {chosenPeo}. Certify again so your Manuscript names {chosenPeo}.
          </div>
        )}
        {certification.status === "stale" && !needsRecertify && !submitted && (
          <div role="status" className="border border-primary/40 bg-primary/5 rounded-xl p-4 text-sm">
            Your answers changed after you certified on {formatSigned(certification.submission.signed_at)}. Review them,
            then certify again. Your File ID stays {certification.submission.file_id}.
          </div>
        )}

        {!certifiedAndCurrent && (
        <>
        <fieldset className="space-y-4">
          <legend className="sr-only">Certification statements</legend>
          {attestations.map((text, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={checks[i]}
                onChange={() => setChecks((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              />
              <span
                aria-hidden="true"
                className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                  checks[i] ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary/60"
                }`}
              >
                {checks[i] && (
                  <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-sm leading-relaxed">{text}</span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground font-mono">
            Consent wording {CONSENT_TEXT_VERSION}
            {CONSENT_IS_DRAFT && " · DRAFT: NOT LEGALLY REVIEWED"}
          </p>
        </fieldset>

        {needsRecertify && (
          <div role="alert" className="border border-primary/40 bg-primary/5 rounded-xl p-4 text-sm">
            Your information changed after you signed, so your earlier signature no longer applies. Review the statements
            and certify again.
          </div>
        )}

        {isAnonymous ? (
          <VerifyEmailGate />
        ) : (
        <>
        {/* Signature */}
        <div className="border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-3">Digital Signature</p>
          {!signed ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{CONSENT_SIGNING_STATEMENT}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  aria-label="Full name"
                  placeholder="Full name"
                  autoComplete="name"
                  className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
                <input
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  aria-label="Role"
                  placeholder="Role (e.g. CEO)"
                  autoComplete="organization-title"
                  className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <button
                onClick={handleSign}
                className="border border-dashed border-muted-foreground/30 rounded-lg w-full py-6 text-muted-foreground hover:border-primary/40 transition-colors text-sm"
              >
                Click to sign digitally
              </button>
            </div>
          ) : (
            <div className="bg-muted rounded-lg py-4 px-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-foreground">
                  {signerName.trim()}, {signerTitle.trim()}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {data.company_name ?? "Company name not provided"} · {signedAt.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => {
                  setSignedAt(null);
                  setSignedDataKey(null);
                  setFailure(null);
                }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* A failed save keeps the signature and the form: nothing was recorded, and the same click tries again. */}
        {failure && !submitting && (
          <div role="alert" aria-label="Submission not saved" className="border border-destructive/40 bg-destructive/5 rounded-xl p-4 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Your submission wasn't saved.</p>
              <p className="text-muted-foreground">{failure} Nothing has been recorded; your signature is still here.</p>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!allChecked || submitting}
          className={`w-full flex items-center justify-center gap-2 font-medium py-4 rounded-lg text-base transition-colors ${
            allChecked
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : failure ? "Try again: Generate The Manuscript →" : "Generate The Manuscript →"}
        </button>
        {blockers.length > 0 && (
          <p className="text-xs text-muted-foreground -mt-4" data-testid="certification-blockers">
            Before you can submit: {blockers.join(" · ")}
          </p>
        )}
        </>
        )}
        </>
        )}
      </div>

      {/* Confirmation Overlay */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-50 bg-background flex items-center justify-center overflow-y-auto"
          >
            <div className="text-center max-w-lg px-6">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <RavenIcon className="w-24 h-24 text-primary mx-auto mb-8" />
              </motion.div>
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                id="certified-heading"
                className="font-display text-4xl md:text-5xl font-bold mb-4"
              >
                The Raven has spoken.
              </motion.h1>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-muted-foreground leading-relaxed mb-6"
              >
                Your submission is certified and saved. Your Manuscript is ready.
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="bg-card border border-border rounded-xl p-6 text-left mb-6 text-sm space-y-1"
              >
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> Certification recorded
                </p>
                <p className="text-muted-foreground">{data.company_name ?? "Company name not provided"}</p>
                <p className="text-muted-foreground">
                  Certified by {submitted.name}, {submitted.title}
                </p>
                <p className="text-muted-foreground">{submitted.at.toLocaleString()}</p>
                <p className="text-muted-foreground font-mono">File ID: {recordedFileId ?? "being assigned"}</p>
                {certification.status === "certified" && certification.submission.version && (
                  <p className="text-muted-foreground font-mono">Version {certification.submission.version}</p>
                )}
                <p className="text-muted-foreground text-xs pt-2">
                  If you change any of your information later, you'll need to certify it again.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="bg-card border border-border rounded-xl p-6 text-left mb-6"
              >
                <p className="text-sm text-muted-foreground mb-3">What's next:</p>
                <ul className="text-sm text-foreground space-y-2">
                  <li>• Download The Manuscript below.</li>
                  <li>• Send it to {peoName} yourself.</li>
                  <li>• Ask {peoName} for pricing and how long their review takes.</li>
                </ul>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="flex flex-col sm:flex-row gap-3 justify-center"
              >
                <Link
                  to={manuscriptUrl}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download The Manuscript
                </Link>
                <Link
                  to={manuscriptUrl}
                  className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-medium px-6 py-3 rounded-lg hover:bg-muted transition-colors"
                >
                  View Full Manuscript
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ReckoningTab;
