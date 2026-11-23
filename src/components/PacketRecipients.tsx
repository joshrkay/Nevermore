import { useEffect, useState } from "react";
import { SaveFailed } from "@/components/workspace/form";
import { DID_NOT_GO_THROUGH, useSaveFailure } from "@/components/workspace/form/failureWords";
import { AUTHORIZATION_WORDING, DRAFT_WORDING_NOTICE, peoAuthorizationText } from "@/data/legalWording";
import { MARKET_WORDS, type QuoteLine } from "@/data/lines";
import { loadIntakeLine, loadPeoAuthorizations, setPeoAuthorization, type PeoAuthorizationState } from "@/lib/peoAuthorizationsApi";

/**
 * The employer's say over which PEOs may receive their packet (M-1.1, D-608): a box per PEO on the product's list. Shown on Certify & sign after the
 * certification and on the employer's profile. On a workers' comp intake the boxes are the carriers (the database lists the markets of the intake's own line,
 * ADR 0029) and every word here says so. `heading` names the group when the screen has its own name for it (the company, on the profile); left out, it is
 * the line's own question.
 */
const PacketRecipients = ({ sessionId, heading }: { sessionId: string; heading?: string }) => {
  const [states, setStates] = useState<PeoAuthorizationState[] | null>(null);
  // What the intake is for, read beside the boxes. A PEO intake until it is read, and when it can't be: the boxes still load, and the database has the last word.
  const [line, setLine] = useState<QuoteLine>("peo");
  const failure = useSaveFailure(DID_NOT_GO_THROUGH);
  const [loadFailed, setLoadFailed] = useState(false);
  // Grows on "Try again", which loads the list afresh.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    loadIntakeLine(sessionId).then(
      (read) => {
        if (!cancelled) setLine(read);
      },
      () => {
        if (!cancelled) setLine("peo");
      },
    );
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

  // Each change is saved as it is made; the box shows it once the database has it.
  const change = async (peo: string, authorized: boolean) => {
    failure.clear();
    try {
      await setPeoAuthorization(sessionId, peo, authorized);
    } catch (error) {
      failure.failed(error);
      return;
    }
    setStates((prev) => prev?.map((s) => (s.peo === peo ? { ...s, state: authorized ? "authorized" : "withdrawn" } : s)) ?? prev);
  };

  const headingId = `packet-recipients-${sessionId}`;
  const wording = AUTHORIZATION_WORDING[line];
  return (
    <fieldset aria-labelledby={headingId} className="space-y-2">
      <legend id={headingId} className="font-medium text-foreground">{heading ?? wording.question}</legend>
      <p className="text-sm text-muted-foreground">{wording.explainer}</p>
      <p className="text-xs text-muted-foreground">Ticking a box records, with that {MARKET_WORDS[line].one}'s name: “{peoAuthorizationText(wording.theOneYouTick)}”</p>
      <p className="text-xs text-muted-foreground">{DRAFT_WORDING_NOTICE}</p>
      {states?.map((s) => {
        const id = `${headingId}-${s.peo}`;
        return (
          <div key={s.peo} className="flex items-center gap-2 text-sm">
            <input id={id} type="checkbox" checked={s.state === "authorized"}
              onChange={(e) => void change(s.peo, e.target.checked)}
              className="h-4 w-4 accent-primary" />
            <label htmlFor={id}>{s.peo}</label>
          </div>
        );
      })}
      {loadFailed && (
        <div role="alert" className="text-sm space-y-1">
          <p>{wording.couldNotLoad}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="text-primary underline underline-offset-2">Try again</button>
        </div>
      )}
      <SaveFailed message={failure.message} />
    </fieldset>
  );
};

export default PacketRecipients;
