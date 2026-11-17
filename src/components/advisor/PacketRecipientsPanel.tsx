import { useEffect, useState } from "react";
import { STATE_WORDS, askToAddPeo } from "@/data/peoAuthorizationWords";
import { loadPeoAuthorizations, type PeoAuthorizationState } from "@/lib/peoAuthorizationsApi";
/**
 * Who may receive the packet (M-1.1, D-608): each PEO's state as the employer left it. A send to a PEO not authorized is refused by the database
 * (advisor_record_quote_send); only the employer can add one.
 */

const PacketRecipientsPanel = ({ sessionId, onAsk }: { sessionId: string; onAsk: (message: string) => void }) => {
  const [states, setStates] = useState<PeoAuthorizationState[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    loadPeoAuthorizations(sessionId).then(
      (rows) => {
        if (!cancelled) setStates(rows);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sessionId, attempt]);

  return (
    <section aria-labelledby="packet-recipients-heading" className="border border-border rounded-xl p-5 space-y-3">
      <h2 id="packet-recipients-heading" className="font-display text-lg font-bold">Who may receive the packet</h2>
      {loadFailed && (
        <div role="alert" className="text-sm space-y-1">
          <p>We couldn't load who may receive the packet.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="text-primary underline underline-offset-2">Try again</button>
        </div>
      )}
      <ul className="space-y-2 text-sm">
        {states?.map((s) => (
          <li key={s.peo} className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{s.peo}</span>
            <span className="text-muted-foreground">{STATE_WORDS[s.state]}</span>
            {s.state !== "authorized" && (
              <button type="button" onClick={() => onAsk(askToAddPeo(s.peo))} className="text-xs text-primary underline underline-offset-2">
                Ask the employer to add {s.peo}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PacketRecipientsPanel;
