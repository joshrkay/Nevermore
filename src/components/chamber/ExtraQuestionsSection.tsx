import { useId, useState } from "react";
import { ListChecks } from "lucide-react";
import {
  answerExtra,
  answerFor,
  confirmExtra,
  extraProgress,
  resolveExtra,
  type ExtraAnswer,
  type ExtraAnswers,
  type ExtraValue,
} from "@/data/extraAnswers";
import type { ExtraQuestion } from "@/data/peoProfiles";
import { formatFieldValue } from "@/data/provenance";
import { BADGES, sourceLine } from "./workspace/statusBadges";

interface ExtraQuestionsSectionProps {
  peo: { id: number; name: string };
  /** The PEO's extra questions, from its profile in use. */
  questions: readonly ExtraQuestion[];
  answers: ExtraAnswers;
  /** Changes the answers (useChamberSession's updateExtraAnswers). Omit to show them read-only. */
  onChange?: (update: (prev: ExtraAnswers) => ExtraAnswers) => void;
  /** The keys of the questions the advisor's open information request names. */
  requested?: ReadonlySet<string>;
  now?: () => Date;
}

const field = "w-full min-h-11 bg-background border border-border rounded-lg px-3 py-2 text-sm disabled:opacity-60";

/** One question, with the control its kind takes. Each change is saved as it is made. */
const Question = ({ peoId, q, answer, onChange, now, asked }: {
  peoId: number;
  q: ExtraQuestion;
  answer: ExtraAnswer | null;
  asked: boolean;
  onChange?: ExtraQuestionsSectionProps["onChange"];
  now: () => Date;
}) => {
  const id = useId();
  const readOnly = !onChange;
  const save = (value: ExtraValue | null) => onChange?.((prev) => answerExtra(prev, peoId, q, value, now()));
  // A number is kept as typed until it is one; only a number is saved.
  const [numberDraft, setNumberDraft] = useState<string | null>(null);
  const value = answer?.value;
  const status = answer?.status;
  const badge = status && !(status === "confirmed" && answer?.source.kind === "prospect_edit") ? BADGES[status] : null;

  const control = () => {
    switch (q.kind) {
      case "yes_no":
        return (
          <div role="radiogroup" aria-labelledby={`${id}-q`} className="flex flex-wrap gap-2">
            {([["Yes", true], ["No", false]] as const).map(([label, v]) => (
              <label key={label} className={`min-h-11 min-w-24 inline-flex items-center justify-center gap-2 rounded-lg border px-4 text-sm cursor-pointer ${value === v ? "border-primary bg-primary/10" : "border-border"}`}>
                <input type="radio" name={`${id}-yes-no`} checked={value === v} disabled={readOnly} onChange={() => save(v)} className="w-4 h-4" />
                {label}
              </label>
            ))}
          </div>
        );
      case "number":
        return (
          <>
            <input
              id={`${id}-input`}
              type="number"
              inputMode="decimal"
              aria-labelledby={`${id}-q`}
              disabled={readOnly}
              value={numberDraft ?? (typeof value === "number" ? String(value) : "")}
              onChange={(e) => {
                const text = e.target.value;
                const n = Number(text);
                if (text.trim() === "") { setNumberDraft(null); save(null); }
                else if (Number.isFinite(n)) { setNumberDraft(null); save(n); }
                else setNumberDraft(text);
              }}
              className={field}
            />
            {numberDraft !== null && <p className="text-xs text-warning mt-1">Enter a number, such as 12.</p>}
          </>
        );
      case "choice":
        return (
          <select aria-labelledby={`${id}-q`} disabled={readOnly} value={typeof value === "string" ? value : ""} onChange={(e) => save(e.target.value || null)} className={field}>
            <option value="">Choose…</option>
            {(q.choices ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        );
      case "text":
        return (
          <textarea aria-labelledby={`${id}-q`} disabled={readOnly} rows={3} maxLength={1000} value={typeof value === "string" ? value : ""}
            onChange={(e) => save(e.target.value.trim() === "" ? null : e.target.value)} className={field} />
        );
    }
  };

  return (
    <li><div role="group" aria-labelledby={`${id}-q`} className="space-y-2">
      <p className="text-sm font-medium">
        <span id={`${id}-q`}>{q.text}</span>
        {asked && <span className="ml-1.5 text-xs font-medium text-warning">Your advisor asked about this</span>}
      </p>
      {control()}
      {badge && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full ${badge.color}`}>{badge.text}</span>
          {answer && answer.value !== undefined && status !== "conflicting" && <span className="text-muted-foreground">{sourceLine(answer.source)}</span>}
          {onChange && status === "inferred" && (
            <button type="button" onClick={() => onChange((prev) => confirmExtra(prev, peoId, q, now()))} aria-label={`Confirm ${q.text}`}
              className="min-h-11 px-3 rounded-md border border-border hover:border-primary/40">
              Confirm
            </button>
          )}
        </div>
      )}
      {status === "conflicting" && answer?.candidates && (
        <ul aria-label={`Answers given to ${q.text}`} className="flex flex-wrap gap-2 text-xs">
          {answer.candidates.map((c, i) => (
            <li key={i}>
              {onChange ? (
                <button type="button" onClick={() => onChange((prev) => resolveExtra(prev, peoId, q, i, now()))}
                  className="min-h-11 px-3 rounded-md border border-border hover:border-primary/40" aria-label={`Use ${formatFieldValue(c.value)}`}>
                  {`Use ${formatFieldValue(c.value)}`}
                </button>
              ) : formatFieldValue(c.value)}
              <span className="block text-muted-foreground">{sourceLine(c.source)}</span>
            </li>
          ))}
        </ul>
      )}
    </div></li>
  );
};

/**
 * Questions from <PEO> (L-2.3): one PEO's own extra questions, asked only for that PEO, each with the control its kind
 * takes and saved as typed. They never block certifying, and their answers go only to that PEO. An answer is shown
 * only against the wording it was given to (answerFor): a reworded question is a new one.
 */
const NONE_ASKED: ReadonlySet<string> = new Set();

const ExtraQuestionsSection = ({ peo, questions, answers, onChange, requested = NONE_ASKED, now = () => new Date() }: ExtraQuestionsSectionProps) => {
  const id = useId();
  const { answered, total } = extraProgress(answers, peo.id, questions);
  return (
    <section aria-labelledby={`${id}-heading`} className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="space-y-1">
        <h3 id={`${id}-heading`} className="font-display text-lg font-bold flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          {`Questions from ${peo.name}`}
        </h3>
        <p className="text-sm text-muted-foreground">
          {`${peo.name} asks these on top of the usual questions. Your answers go only to ${peo.name}. You can certify without them, and come back to them later.`}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{`${answered} of ${total} answered`}</p>
        <div role="progressbar" aria-label={`Questions from ${peo.name} answered`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}
          className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
        </div>
      </div>
      <ol className="space-y-5">
        {questions.map((q) => (
          <Question key={q.key} peoId={peo.id} q={q} answer={answerFor(answers, peo.id, q)} onChange={onChange} now={now} asked={requested.has(q.key)} />
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">Changing an answer after you certify means certifying again.</p>
    </section>
  );
};

export default ExtraQuestionsSection;
