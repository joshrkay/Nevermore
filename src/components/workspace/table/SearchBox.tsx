import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { searchTermFor } from "./address";

/** Searching waits for a pause in typing, so the database isn't asked once per keystroke. */
export const SEARCH_DELAY_MS = 300;

interface Props {
  /** What the address holds as the search. */
  value: string;
  minChars: number;
  placeholder: string;
  /** Called after a pause with the words to search for (empty when what is typed is too short to search). */
  onSearch: (term: string) => void;
}

/** The search box: typed text is the person's own until a pause; the address follows it, and follows the address when that changes from outside (Back, a link). */
export function SearchBox({ value, minChars, placeholder, onSearch }: Props) {
  const [typed, setTyped] = useState(value);
  // The latest callback, so a page that draws again while someone types doesn't restart the pause.
  const latest = useRef(onSearch);
  latest.current = onSearch;
  // Follow the address when it changes from outside, but not when it only caught up with what is being typed: that would drop a
  // space typed just before a pause, or a search still too short.
  useEffect(() => setTyped((t) => (searchTermFor(t, minChars) === value ? t : value)), [value, minChars]);
  useEffect(() => {
    if (searchTermFor(typed, minChars) === value) return;
    const timer = setTimeout(() => latest.current(searchTermFor(typed, minChars)), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed, value, minChars]);
  const tooShort = typed.trim() !== "" && searchTermFor(typed, minChars) === "";
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <label htmlFor="table-search" className="sr-only">Search</label>
      <input
        id="table-search"
        type="search"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={placeholder}
        aria-describedby="table-search-hint"
        className="w-64 rounded-md border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
      />
      <p id="table-search-hint" aria-live="polite" className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs text-muted-foreground">
        {tooShort ? `Type at least ${minChars} characters to search.` : ""}
      </p>
    </div>
  );
}
