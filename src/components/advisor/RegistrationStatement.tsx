import { useState } from "react";
import { Loader2 } from "lucide-react";
import { failureWords } from "@/components/workspace/form";
import { registrationStatementFile } from "@/data/peoRegistrations";
import { downloadBlob } from "@/lib/downloadFile";
import { loadRegistrationStatement } from "@/lib/peoRegistrationsApi";

/**
 * The firm's statement of its own registrations with PEOs (Q-2.1, slice 6.10): every send of a packet to a PEO, when, the employer by its FEIN's last
 * four digits (or its name and state), the File ID and the version, as a dated CSV. The firm's own and never another's: the database decides.
 */
const RegistrationStatement = ({ firmId }: { firmId: string }) => {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const { blob, name } = registrationStatementFile(await loadRegistrationStatement(firmId));
      downloadBlob(blob, name);
    } catch (err) {
      setProblem(failureWords(err, "We couldn't make the statement. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Each time your firm sends an employer's packet to a PEO, Nevermore records when, which PEO, the employer and the version. Nobody can change or
        delete a record, so the statement is your proof of when you submitted each employer.
      </p>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void download()}
        className="min-h-11 px-3 inline-flex items-center gap-2 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        Download the statement (CSV)
      </button>
    </div>
  );
};

export default RegistrationStatement;
