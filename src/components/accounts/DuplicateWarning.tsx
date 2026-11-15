import { Link } from "react-router-dom";
import type { DuplicateMatch, DuplicateReason, Duplicates, WhoToAsk } from "@/lib/duplicateApi";

// The duplicate warning of the New account and Add a contact forms (story CRM-S4.2, screens 23 and 24; D-193, D-600 to D-604). While the person types, the database
// says which of the firm's records may be the same, by the one rule the chain at certification uses. A record the person may see is named with its owner and a link
// that opens it in a new tab, so what they have typed is kept; one they may not see is only said to exist, with who to ask. The warning never blocks anything: the
// form's save is as it was, and a check that fails shows nothing. Merging is not offered here (CRM-S4.3).

const accountPath = (id: string) => `/accounts/${encodeURIComponent(id)}`;
const contactPath = (id: string) => `/contacts/${encodeURIComponent(id)}`;

const REASON_WORDS: Record<DuplicateReason, string> = { website: "same website", name: "same name and state", email: "same email" };
const because = (reasons: DuplicateReason[]) => reasons.map((r) => REASON_WORDS[r]).join(" and ");

const asking = (ask: WhoToAsk) => (ask.kind === "owner" && ask.names.length === 1
  ? `Ask ${ask.names[0]}.`
  : ask.names.length > 0 ? `Ask one of the firm's owners: ${ask.names.join(", ")}.` : "Ask one of the firm's owners.");

function Seen({ match }: { match: Extract<DuplicateMatch, { visible: true }> }) {
  const owner = match.owner ? `Owner: ${match.owner.name}` : "No owner";
  const notes = [because(match.reasons), owner, match.archived ? "Archived" : null].filter(Boolean).join(" · ");
  return (
    <li>
      {match.kind === "contact" ? (
        <>
          <Link to={contactPath(match.id)} target="_blank" rel="noopener noreferrer" className="font-medium underline">{match.name}</Link>
          {" on "}
          <Link to={accountPath(match.account.id)} target="_blank" rel="noopener noreferrer" className="underline">{match.account.name}</Link>
        </>
      ) : (
        <Link to={accountPath(match.id)} target="_blank" rel="noopener noreferrer" className="font-medium underline">{match.name}</Link>
      )}
      <span className="text-muted-foreground">{` (${notes})`}</span>
    </li>
  );
}

/**
 * What the form says about the matches, or nothing when there are none. `kind` says what is being made, for the words.
 */
export function DuplicateWarning({ found, kind }: { found: Duplicates | undefined; kind: "account" | "contact" }) {
  if (!found || found.matches.length === 0) return null;
  const seen = found.matches.filter((m): m is Extract<DuplicateMatch, { visible: true }> => m.visible);
  const masked = found.matches.filter((m): m is Extract<DuplicateMatch, { visible: false }> => !m.visible);
  return (
    <section role="status" aria-label="Possible duplicate" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-medium">{kind === "account" ? "This may already be an account." : "This email is already on a contact."}</p>
      {seen.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {seen.map((m) => <Seen key={`${m.kind}:${m.id}`} match={m} />)}
        </ul>
      )}
      {found.more > 0 && <p>{found.more === 1 ? "And 1 more you can see." : `And ${found.more} more you can see.`}</p>}
      {masked.map((m, i) => (
        <p key={i}>{m.kind === "account" ? "An account like this exists that you can't see." : "A contact with this email exists on an account you can't see."} {asking(m.ask)}</p>
      ))}
      <p>{seen.length > 0 ? "Open it in a new tab to check; what you've typed here is kept. You can still save." : "You can still save."}</p>
    </section>
  );
}
