import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** An unsent message as the place to write keeps it. */
export interface Draft {
  subject: string;
  body: string;
}

const EMPTY: Draft = { subject: "", body: "" };

function read(key: string): Draft {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return EMPTY;
    const d = JSON.parse(raw) as Partial<Draft>;
    return { subject: typeof d.subject === "string" ? d.subject : "", body: typeof d.body === "string" ? d.body : "" };
  } catch {
    return EMPTY;
  }
}

/**
 * The unsent message across leaving the page and coming back (D-653): connecting a mailbox goes to Google or Microsoft and returns to the place to
 * write. Kept in this tab's session storage only, by record, and forgotten once sent; where storage can't be had it is simply not kept.
 */
export function useDraft(key: string): [Draft, Dispatch<SetStateAction<Draft>>, () => void] {
  const [draft, setDraft] = useState<Draft>(() => read(key));
  useEffect(() => {
    try {
      if (draft.subject === "" && draft.body === "") window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* not kept */
    }
  }, [key, draft]);
  const clear = useCallback(() => setDraft(EMPTY), []);
  return [draft, setDraft, clear];
}
