import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PipelineStatus } from "@/data/advisor";
import { localToday } from "@/data/peoProfiles";
import { canRecordSend, formatDay } from "@/data/quoteRequests";
import { recordQuoteSend, type QuoteRequestRow } from "@/lib/advisorApi";
import { unchangedSinceOpened, type BuiltFrom } from "@/lib/certificationCheck";
import { failureWords } from "@/components/workspace/form/failureWords";

interface RecordSendPromptProps {
  sessionId: string;
  peo: string;
  stage: PipelineStatus;
  /** The certification the bundle was built from: a send is recorded only while it is still the one on record. */
  builtFrom: BuiltFrom;
  /** The PEO's quote request, when a send to it is already recorded. */
  existing?: Pick<QuoteRequestRow, "status" | "sent_on">;
  onRecorded: () => void;
  onClose: () => void;
}

/**
 * Shown to an advisor right after they download a PEO's bundle: did it go to the PEO? "Record it" records the send as a
 * quote request (advisor_record_quote_send: the PEO, today, and the latest certified version, which is the one the
 * bundle holds); "Not yet" records nothing. A download is never a send by itself. Where the stage allows no send, it
 * says what would, and offers nothing to click that would be refused.
 *
 * Recording a send again replaces the request's send date and version, and reopens a closed one: so for a PEO that
 * already has a quote request it says when the send was recorded, and offers to record it again as sent today only
 * while the request is still waiting (a resend), never once it is quoted, declined or closed.
 */
const RecordSendPrompt = ({ sessionId, peo, stage, builtFrom, existing, onRecorded, onClose }: RecordSendPromptProps) => {
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const record = async () => {
    setSaving(true);
    setRefused(null);
    try {
      if (!(await unchangedSinceOpened(builtFrom))) return;
      await recordQuoteSend(sessionId, peo, localToday());
      toast.success(`Recorded the send to ${peo}.`);
      onRecorded();
    } catch (err) {
      setRefused(failureWords(err, "The send wasn't recorded. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  const recorded = existing ? `Already recorded as sent to ${peo}${existing.sent_on ? ` on ${formatDay(existing.sent_on)}` : ""}.` : null;
  const offer = !existing || existing.status === "sent";
  if (!offer) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-2 text-sm border border-border rounded-md p-2">
        <span className="flex-1">{recorded}</span>
        <button type="button" onClick={onClose} className="min-h-11 px-3 rounded-md border border-border text-sm">Close</button>
      </div>
    );
  }
  if (!canRecordSend(stage)) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-2 text-sm border border-border rounded-md p-2">
        {recorded && <span className="w-full">{recorded}</span>}
        <span className="flex-1">{`To record a send to ${peo}, move this submission to Ready for market first.`}</span>
        <button type="button" onClick={onClose} className="min-h-11 px-3 rounded-md border border-border text-sm">Not yet</button>
      </div>
    );
  }
  return (
    <div className="space-y-2 border border-primary/40 rounded-md p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex-1">{recorded ?? `Sent this to ${peo}?`}</span>
        <button type="button" onClick={() => void record()} disabled={saving} className="min-h-11 px-3 inline-flex items-center gap-2 rounded-md border border-primary text-primary text-sm font-medium disabled:opacity-60">
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} {recorded ? "Record it again as sent today" : "Record it"}
        </button>
        <button type="button" onClick={onClose} disabled={saving} className="min-h-11 px-3 rounded-md border border-border text-sm">Not yet</button>
      </div>
      {refused && <p role="alert" className="text-xs text-destructive">{refused}</p>}
    </div>
  );
};

export default RecordSendPrompt;
