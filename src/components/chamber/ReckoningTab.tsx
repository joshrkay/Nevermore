import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RavenIcon } from "../RavenLogo";
import { CheckCircle, Download, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { ChamberData } from "@/data/chamberTypes";
import { fileIdForSession, NO_CERTIFICATION, type CertificationState, type ChamberSubmission } from "@/data/manuscript";
import {
  certificationConsent,
  fileIdForSession,
  NO_CERTIFICATION,
  type CertificationState,
  type ChamberSubmission,
} from "@/data/manuscript";
import { useAuth } from "@/hooks/useAuth";
import VerifyEmailGate from "./VerifyEmailGate";

interface ReckoningTabProps {
  data: ChamberData;
  /** The PEO the packet is prepared for, if the prospect chose one. */
  peoName: string | null;
  sessionId: string | null;
  onSubmit: (submission: ChamberSubmission) => Promise<boolean>;
  /** Whether this intake is already certified, or was changed after it was. */
  certification?: CertificationState;
}

const formatSigned = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

const ReckoningTab = ({ data, peoName: chosenPeo, sessionId, onSubmit, certification = NO_CERTIFICATION }: ReckoningTabProps) => {
  const peoName = chosenPeo ?? "your PEO";
  const { isAnonymous } = useAuth();
  // A returning signer doesn't retype their name and role to certify again.
  const previous = certification.status === "none" ? null : certification.submission;
  const [checks, setChecks] = useState([false, false, false]);
  const [signerName, setSignerName] = useState(previous?.signer_name ?? "");
  const [signerTitle, setSignerTitle] = useState(previous?.signer_title ?? "");
  const [signedAt, setSignedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ChamberSubmission | null>(null);

  const fileId = useMemo(() => (sessionId ? fileIdForSession(sessionId) : null), [sessionId]);
  const signed = signedAt !== null;
  const manuscriptUrl = sessionId ? `/manuscript?session=${sessionId}` : "/manuscript";

  const handleSign = () => {
    if (!signerName.trim() || !signerTitle.trim()) {
      toast.error("Enter your full name and role to sign.");
      return;
    }
    setSignedAt(new Date());
  };

  const handleSubmit = async () => {
    if (!canSubmit || !fileId || !signedAt) return;
    setSubmitting(true);
    const submission: ChamberSubmission = {
      signer_name: signerName.trim(),
      signer_title: signerTitle.trim(),
      signed_at: signedAt.toISOString(),
      file_id: fileId,
      consent_text_version: CONSENT_TEXT_VERSION,
      // Same version under the name the database's certification check reads.
      consent_version: CONSENT_TEXT_VERSION,
      consent_text: [...attestations, CONSENT_SIGNING_STATEMENT],
      ...(chosenPeo ? { peo: chosenPeo } : {}),
    };
    const ok = await onSubmit(submission);
    setSubmitting(false);
    if (ok) setSubmitted(submission);
    else toast.error("We couldn't save your certification. Your answers are safe; please try again.");
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

        {/* What's already on record for this intake */}
        {certification.status === "certified" && !needsRecertify && !submitted && (
          <div role="status" className="border border-success/40 bg-success/5 rounded-xl p-4 text-sm">
            Certified by {certification.submission.signer_name}, {certification.submission.signer_title}, on{" "}
            {formatSigned(certification.submission.signed_at)}. File ID: {certification.submission.file_id}.{" "}
            <Link to={manuscriptUrl} className="underline">View The Manuscript</Link>
          </div>
        )}
        {certification.status === "stale" && !needsRecertify && !submitted && (
          <div role="status" className="border border-primary/40 bg-primary/5 rounded-xl p-4 text-sm">
            Your answers changed after you certified on {formatSigned(certification.submission.signed_at)}. Review them,
            then certify again.
          </div>
        )}

        <fieldset className="space-y-4">
          <legend className="sr-only">Certification statements</legend>
          {attestations.map((text, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={checks[i]}
                onChange={() => setChecks((prev) => prev.map((c, j) => (j === i ? !c : c)))}
                className="sr-only peer"
              />
              <div
                aria-hidden
                className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                  checks[i] ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary/60"
                }`}
              >
                {checks[i] && (
                  <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm leading-relaxed">{text}</span>
            </label>
          ))}
        </div>

        {isAnonymous ? (
          <VerifyEmailGate />
        ) : (
        <>
        {/* Signature */}
        <div className="border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-3">Digital Signature</p>
          {!signed ? (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Full name"
                  className={inputClass}
                />
                <input
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  placeholder="Role (e.g. CEO)"
                  className={inputClass}
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
                  {data.company_name ?? "Company name not provided"} · {formatSigned(signedAt.toISOString())}
                </p>
              </div>
              <button onClick={() => setSignedAt(null)} className="text-xs text-muted-foreground underline hover:text-foreground flex-shrink-0">
                Edit
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allChecked || submitting}
          className={`w-full flex items-center justify-center gap-2 font-medium py-4 rounded-lg text-base transition-colors ${
            allChecked
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate The Manuscript →"}
        </button>
        </>
        )}
      </div>

      {/* Confirmation Overlay */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="certified-heading"
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
                Your certification is recorded and your Manuscript is ready.
                <span className="block mt-2 font-mono text-sm text-foreground">
                  Certified by {submitted.signer_name}, {submitted.signer_title} · {formatSigned(submitted.signed_at)}
                </span>
                <span className="block font-mono text-sm text-foreground">File ID: {fileId}</span>
              </motion.p>
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
