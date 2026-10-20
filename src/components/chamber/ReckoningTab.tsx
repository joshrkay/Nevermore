import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RavenIcon } from "../RavenLogo";
import { Download, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { ChamberData } from "@/data/chamberTypes";
import { fileIdForSession, type ChamberSubmission } from "@/data/manuscript";

interface ReckoningTabProps {
  data: ChamberData;
  /** The PEO the packet is prepared for, if the prospect chose one. */
  peoName: string | null;
  sessionId: string | null;
  onSubmit: (submission: ChamberSubmission) => Promise<boolean>;
}

const ReckoningTab = ({ data, peoName: chosenPeo, sessionId, onSubmit }: ReckoningTabProps) => {
  const peoName = chosenPeo ?? "your PEO";
  const [checks, setChecks] = useState([false, false, false]);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signedAt, setSignedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const attestations = [
    "The information I've provided is accurate and complete to the best of my knowledge.",
    "All employees listed are W-2. Any K-1 owners or 1099 contractors have been identified separately.",
    `I understand this packet is prepared for me to send to ${peoName} myself. Edgar Allan Advisory does not submit it or request a quote for me.`,
  ];

  const fileId = useMemo(() => (sessionId ? fileIdForSession(sessionId) : null), [sessionId]);
  const signed = signedAt !== null;
  const allChecked = checks.every(Boolean) && signed && !!fileId;
  const manuscriptUrl = sessionId ? `/manuscript?session=${sessionId}` : "/manuscript";

  const handleSign = () => {
    if (!signerName.trim()) {
      toast.error("Type your full name to sign.");
      return;
    }
    setSignedAt(new Date());
  };

  const handleSubmit = async () => {
    if (!allChecked || !fileId || !signedAt) return;
    setSubmitting(true);
    const ok = await onSubmit({
      signer_name: signerName.trim(),
      signer_title: signerTitle.trim(),
      signed_at: signedAt.toISOString(),
      file_id: fileId,
      ...(chosenPeo ? { peo: chosenPeo } : {}),
    });
    setSubmitting(false);
    if (ok) setSubmitted(true);
    else toast.error("We couldn't save your submission. Please try again.");
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

        <div className="space-y-4">
          {attestations.map((text, i) => (
            <div
              key={i}
              onClick={() => {
                const next = [...checks];
                next[i] = !next[i];
                setChecks(next);
              }}
              className="flex items-start gap-3 cursor-pointer group"
            >
              <div
                className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
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
            </div>
          ))}
        </div>

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
                  className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
                <input
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  placeholder="Title (e.g. CEO)"
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
            <div className="bg-muted rounded-lg py-4 px-6">
              <p className="font-mono text-foreground">
                {signerName.trim()}{signerTitle.trim() && `, ${signerTitle.trim()}`}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {data.company_name ?? "Company name not provided"} · {signedAt.toLocaleString()}
              </p>
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
      </div>

      {/* Confirmation Overlay */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-background flex items-center justify-center"
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
                Your Manuscript is ready. File ID: {fileId}
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
