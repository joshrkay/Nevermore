import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RavenIcon } from "../RavenLogo";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { ChamberData } from "@/data/chamberTypes";
import {
  CONSENT_IS_DRAFT,
  CONSENT_SIGNING_STATEMENT,
  CONSENT_TEXT_VERSION,
  certificationBlockers,
  consentStatements,
} from "@/data/certification";
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

const inputClass =
  "w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";

const ReckoningTab = ({ data, peoName: chosenPeo, sessionId, onSubmit, certification = NO_CERTIFICATION }: ReckoningTabProps) => {
  const peoName = chosenPeo ?? "your PEO";
  const { isAnonymous } = useAuth();
  const previous = certification.status === "none" ? null : certification.submission;
  const consent = useMemo(
    () => certificationConsent({ companyName: data.company_name, peo: chosenPeo }),
    [data.company_name, chosenPeo],
  );
  const [checks, setChecks] = useState(() => consent.statements.map(() => false));
  const [signerName, setSignerName] = useState(previous?.signer_name ?? "");
  const [signerTitle, setSignerTitle] = useState(previous?.signer_title ?? "");
  const [signedAt, setSignedAt] = useState<Date | null>(null);
  // The data as it stood when signed; if it moves on, the signature no longer covers it.
  const [signedDataKey, setSignedDataKey] = useState<string | null>(null);
  const [needsRecertify, setNeedsRecertify] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ name: string; title: string; at: Date } | null>(null);

  const attestations = consentStatements(chosenPeo);
  const dataKey = useMemo(() => JSON.stringify(data), [data]);

  // Any change after signing (an edit in a tab, or Lenore updating a field) voids the signature,
  // even after a successful submit: the prospect certified the earlier version, not this one.
  // The database withdraws the saved certification for the same reason.
  useEffect(() => {
    if (signedDataKey === null || signedDataKey === dataKey) return;
    setSignedAt(null);
    setSignedDataKey(null);
    setChecks([false, false, false]);
    setSubmitted(null);
    setNeedsRecertify(true);
  }, [dataKey, signedDataKey]);

  const fileId = useMemo(() => (sessionId ? fileIdForSession(sessionId) : null), [sessionId]);
  const signed = signedAt !== null;
  const blockers = certificationBlockers({
    acknowledged: checks,
    signer: { name: signerName, title: signerTitle },
    signed,
    hasFileId: !!fileId,
    isGuest: isAnonymous,
  });
  const allChecked = blockers.length === 0;
  const manuscriptUrl = sessionId ? `/manuscript?session=${sessionId}` : "/manuscript";

  // A signature covers the answers as they were when it was made.
  const dataRef = useRef(data);
  useEffect(() => {
    if (dataRef.current === data) return;
    dataRef.current = data;
    if (signedAt) {
      setSignedAt(null);
      toast.message("Your answers changed, so please sign again.");
    }
  }, [data, signedAt]);

  const missing = [
    !checks.every(Boolean) && "tick each statement above",
    !signerName.trim() && "your full name",
    !signerTitle.trim() && "your role",
    signerName.trim() && signerTitle.trim() && !signed && "sign",
    !fileId && "wait for your intake to finish saving",
  ].filter((m): m is string => typeof m === "string");
  const canSubmit = missing.length === 0 && !isAnonymous;

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
  };

  const handleSubmit = async () => {
    if (!allChecked || !fileId || !signedAt || signedDataKey !== dataKey) return;
    setSubmitting(true);
    const submission: ChamberSubmission = {
      signer_name: signerName.trim(),
      signer_title: signerTitle.trim(),
      signed_at: signedAt.toISOString(),
      file_id: fileId,
      consent_version: consent.version,
      consent_text: consent.text,
      ...(chosenPeo ? { peo: chosenPeo } : {}),
    };
    const ok = await onSubmit(submission);
    setSubmitting(false);
    if (ok) {
      setSubmitted({ name: signerName.trim(), title: signerTitle.trim(), at: signedAt });
      toast.success("Your certification was recorded and your submission is saved.");
    } else {
      toast.error("We couldn't save your submission. Please try again.");
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

        {certification.status === "certified" ? (
          <div className="border border-success/40 bg-success/5 rounded-xl p-6 space-y-3" role="status">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle className="w-5 h-5 text-success" /> Certified and submitted
            </p>
            <p className="text-sm text-muted-foreground">
              Signed by {certification.submission.signer_name}, {certification.submission.signer_title}, on{" "}
              {formatSigned(certification.submission.signed_at)}. File ID: {certification.submission.file_id}
            </p>
            <p className="text-sm text-muted-foreground">
              If you change any of your answers, you'll be asked to certify again.
            </p>
            <Link
              to={manuscriptUrl}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              <Download className="w-4 h-4" /> Open The Manuscript
            </Link>
          </div>
        ) : (
        <>
        {certification.status === "stale" && (
          <div role="alert" className="border border-warning/40 bg-warning/10 rounded-xl p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <span>
              Your answers changed after you certified on {formatSigned(previous!.signed_at)}. Review them, then
              certify again to generate an updated Manuscript.
            </span>
          </div>
        )}

        <div className="space-y-4">
          {consent.statements.map((text, i) => (
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
          <p className="text-sm leading-relaxed mb-4">{consent.signing}</p>
          {!signed ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{CONSENT_SIGNING_STATEMENT}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  aria-label="Full name"
                  autoComplete="name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  aria-label="Full name"
                  placeholder="Full name"
                  autoComplete="name"
                  className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
                <input
                  aria-label="Role"
                  autoComplete="organization-title"
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
                }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {!canSubmit && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Still needed: {missing.join(", ")}.
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`w-full flex items-center justify-center gap-2 font-medium py-4 rounded-lg text-base transition-colors ${
            canSubmit
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate The Manuscript →"}
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
                <p className="text-muted-foreground">
                  Certified by {submitted.name}, {submitted.title}
                </p>
                <p className="text-muted-foreground">{submitted.at.toLocaleString()}</p>
                <p className="text-muted-foreground font-mono">File ID: {fileId}</p>
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
