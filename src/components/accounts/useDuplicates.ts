import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { checkAccountDuplicates, checkContactDuplicates, type Duplicates } from "@/lib/duplicateApi";

// The two questions the duplicate warning asks while a person types (story CRM-S4.2, D-601 to D-603). See DuplicateWarning for what is shown.

const WAIT_MS = 400;

function useDebounced<T>(value: T, ms: number): T {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return held;
}

/** The firm's accounts that may be the same as the one being typed: asked once the person stops typing, and only when there is a website, or a name and a state. */
export function useAccountDuplicates(firmId: string, fields: { name: string; website: string; state: string }): Duplicates | undefined {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const name = useDebounced(fields.name.trim(), WAIT_MS);
  const website = useDebounced(fields.website.trim(), WAIT_MS);
  const state = useDebounced(fields.state.trim(), WAIT_MS);
  const ready = me !== "" && (website !== "" || (name !== "" && state !== ""));
  // The answer depends on who asks (what they may see), so it is kept for no one else and not past this form.
  const found = useQuery({ queryKey: ["duplicates", "account", firmId, me, name, website, state], queryFn: () => checkAccountDuplicates(firmId, { name, website, state }), enabled: ready, retry: false, gcTime: 0 });
  return ready ? found.data : undefined;
}

/** The firm's contacts with the email being typed: asked once the person stops typing and it looks like an address. */
export function useContactDuplicates(firmId: string, email: string): Duplicates | undefined {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const typed = useDebounced(email.trim(), WAIT_MS);
  const ready = me !== "" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed);
  const found = useQuery({ queryKey: ["duplicates", "contact", firmId, me, typed], queryFn: () => checkContactDuplicates(firmId, typed), enabled: ready, retry: false, gcTime: 0 });
  return ready ? found.data : undefined;
}
