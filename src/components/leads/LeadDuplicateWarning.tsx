import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { checkLeadDuplicates, type LeadDuplicateMatch, type LeadDuplicateReason } from "@/lib/leadDuplicateApi";

// The duplicate warning of the New lead form (BR-5.4), as the New account form has one (CRM-S4.2). While the person types, the database says which of the
// firm's leads and accounts may be the same person or business. One the person may see is named with a link that opens it in a new tab, so what they have
// typed is kept; one they may not see is only said to exist, with who to ask. It never blocks the save, and a check that fails shows nothing.

const WAIT_MS = 400;
const REASONS: Record<"lead" | "account", Record<LeadDuplicateReason, string>> = {
  lead: { email: "same email", name: "same name and business", website: "same website" },
  account: { email: "a contact there has this email", name: "same business name and state", website: "same website" },
};

function useDebounced<T>(value: T, ms: number): T {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return held;
}

const asking = (names: string[], one: boolean) => (one && names.length === 1 ? `Ask ${names[0]}.` : names.length > 0 ? `Ask one of the firm's owners: ${names.join(", ")}.` : "Ask one of the firm's owners.");

export function LeadDuplicateWarning({ firmId, name, business, email, state }: { firmId: string; name: string; business: string; email: string; state: string }) {
  const { user } = useAuth();
  const me = user?.id ?? "";
  // Each field is held by itself: a new object on every render would restart the wait for ever.
  const typed = { name: useDebounced(name.trim(), WAIT_MS), business: useDebounced(business.trim(), WAIT_MS), email: useDebounced(email.trim(), WAIT_MS), state: useDebounced(state.trim(), WAIT_MS) };
  // Asked once there is something a match could be made on: an address, or a name with a business.
  const ready = me !== "" && (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed.email) || (typed.name !== "" && typed.business !== ""));
  const found = useQuery({
    queryKey: ["duplicates", "lead", firmId, me, typed.name, typed.business, typed.email, typed.state], queryFn: () => checkLeadDuplicates(firmId, typed), enabled: ready, retry: false, gcTime: 0,
  });
  const matches = ready ? found.data?.matches ?? [] : [];
  if (matches.length === 0) return null;
  const seen = matches.filter((m): m is Extract<LeadDuplicateMatch, { visible: true }> => m.visible);
  const masked = matches.filter((m): m is Extract<LeadDuplicateMatch, { visible: false }> => !m.visible);
  const more = found.data?.more ?? 0;
  return (
    <section role="status" aria-label="Possible duplicate" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-medium">This may already be here.</p>
      {seen.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {seen.map((m) => (
            <li key={`${m.kind}:${m.id}`}>
              <Link to={m.kind === "lead" ? `/leads/${encodeURIComponent(m.id)}` : `/accounts/${encodeURIComponent(m.id)}`} target="_blank" rel="noopener noreferrer" className="font-medium underline">{m.name}</Link>
              <span className="text-muted-foreground">
                {` (${[m.kind === "lead" ? "a lead" : "an account", m.business, m.reasons.map((r) => REASONS[m.kind][r]).join(" and "), m.owner ? `Owner: ${m.owner}` : "No owner"].filter(Boolean).join(" · ")})`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p>{more === 1 ? "And 1 more you can see." : `And ${more} more you can see.`}</p>}
      {masked.map((m, i) => (
        <p key={i}>{m.kind === "lead" ? "A lead like this exists that you can't see." : "An account like this exists that you can't see."} {asking(m.ask.names, m.ask.kind === "owner")}</p>
      ))}
      <p>{seen.length > 0 ? "Open it in a new tab to check; what you've typed here is kept. You can still save." : "You can still save."}</p>
    </section>
  );
}
