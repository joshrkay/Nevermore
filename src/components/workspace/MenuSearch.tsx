import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { accountPath, contactPath, opportunityPath, submissionPath } from "@/components/accounts/accountColumns";
import { NewAccountDialog } from "@/components/accounts/NewAccountDialog";
import { searchTermFor } from "@/components/workspace/table/address";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { STAGE_LABELS } from "@/data/accountPage";
import { myRecentRecords, searchRecords, SearchError, type SearchGroup, type SearchHit, type SearchKind } from "@/lib/searchApi";
import { RECENT_RECORDS_KEY } from "./useNoteOpened";
import { useWorkspace } from "./useWorkspace";

// The search box in the menu (story CRM-S1.2a; D-620 to D-624). Nothing typed shows the last five records the person opened; two or more characters show the
// accounts, contacts, opportunities and quotes found, up to five of each kind, each name opening its record. The database decides who is found and what is
// searched (CRM-S1.2b, D-240); this draws its answer. Where nothing matches, New account opens the form with what was typed as the name.

/** Searching waits for a pause in typing, so the database isn't asked once per keystroke (the tables' search box waits the same). */
export const MENU_SEARCH_DELAY_MS = 300;
/** The shortest search the database answers (D-240); anything shorter shows the recent records. */
export const MENU_SEARCH_MIN_CHARS = 2;

const KIND_WORDS: Record<SearchKind, string> = { account: "Account", contact: "Contact", opportunity: "Opportunity", quote: "Quote" };

/** Where a record opens. An opportunity opens its own page (CRM-O1.1b, D-430, which replaced D-187: its submission's page, or nothing with none); a quote its submission's page. */
export function hitPath(hit: SearchHit): string | null {
  switch (hit.kind) {
    case "account": return accountPath(hit.id);
    case "contact": return contactPath(hit.id);
    case "opportunity": return opportunityPath(hit.id);
    case "quote": return submissionPath(hit.submissionId);
  }
}

const words = (value: string) => value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const joined = (...parts: (string | null | undefined)[]) => parts.filter((p): p is string => !!p && p.trim() !== "").join(" · ");

function describe(hit: SearchHit): { title: string; detail: string } {
  switch (hit.kind) {
    case "account": return { title: hit.name, detail: joined(hit.tradeName, hit.webDomain, hit.city && hit.state ? `${hit.city}, ${hit.state}` : hit.city ?? hit.state) };
    case "contact": return { title: hit.name, detail: joined(hit.title, hit.email, hit.accountName) };
    case "opportunity": return { title: hit.name, detail: joined(STAGE_LABELS[hit.stage as keyof typeof STAGE_LABELS] ?? words(hit.stage), hit.accountName, hit.fileId) };
    case "quote": return { title: hit.peoName, detail: joined(words(hit.status), hit.opportunityName, hit.accountName) };
  }
}

const Result = ({ hit, showKind, onChoose }: { hit: SearchHit; showKind: boolean; onChoose: () => void }) => {
  const { title, detail } = describe(hit);
  const to = hitPath(hit);
  const body = (
    <>
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 truncate font-medium">{title}</span>
        {showKind && <span className="shrink-0 text-xs text-sidebar-foreground/70">{KIND_WORDS[hit.kind]}</span>}
        {hit.archived && <span className="shrink-0 text-xs text-sidebar-foreground/70">Archived</span>}
      </span>
      {detail && <span className="block truncate text-xs text-sidebar-foreground/70">{detail}</span>}
    </>
  );
  const box = "block rounded-md px-2 py-1.5 text-sm";
  return (
    <li>
      {to ? <Link to={to} onClick={onChoose} className={`${box} outline-none ring-sidebar-ring hover:bg-sidebar-accent focus-visible:ring-2`}>{body}</Link> : <span className={box}>{body}</span>}
    </li>
  );
};

const Group = ({ label, group, onChoose, seeAll }: { label: string; group: SearchGroup<SearchHit>; onChoose: () => void; seeAll?: { to: string } }) =>
  group.rows.length === 0 ? null : (
    <section aria-label={label}>
      <h3 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70">{label}</h3>
      <ul>{group.rows.map((hit) => <Result key={`${hit.kind}-${hit.id}`} hit={hit} showKind={false} onChoose={onChoose} />)}</ul>
      {group.more && seeAll && <Link to={seeAll.to} onClick={onChoose} className="block px-2 py-1 text-sm font-medium text-sidebar-primary underline-offset-2 hover:underline">See all {label.toLowerCase()}</Link>}
    </section>
  );

/** What is searched: whole characters, at most the 200 the database keeps (D-240), runs of spaces as one. */
const squeeze = (typed: string) => searchTermFor(typed.replace(/\s+/g, " "), 0);
/** How long a search is, in characters as the database counts them: an emoji is one, though JavaScript's length says two. */
const charsIn = (text: string) => Array.from(text).length;

/** The search box with its results. It sits in the menu, so it is mounted for every workspace page and holds the New account form it offers. */
export default function MenuSearch() {
  const { firm, person, isSupport } = useWorkspace();
  const { signOut, user } = useAuth();
  const userId = user?.id ?? null;
  const firmId = firm?.id ?? null;
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  const { pathname, search: here } = useLocation();
  const [typed, setTyped] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useId();

  // The words searched follow what is typed after a pause; fewer than two characters is no search.
  useEffect(() => {
    const next = squeeze(typed);
    const asked = charsIn(next) >= MENU_SEARCH_MIN_CHARS ? next : "";
    if (asked === term) return;
    if (asked === "") { setTerm(""); return; }
    const timer = setTimeout(() => setTerm(asked), MENU_SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed, term]);

  // Going to another page ends the search; so does a click elsewhere or Escape (D-621): each empties and closes it.
  const end = () => { setOpen(false); setTyped(""); setTerm(""); };
  useEffect(() => { setOpen(false); setTyped(""); setTerm(""); }, [pathname, here]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) { setOpen(false); setTyped(""); setTerm(""); } };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const typing = charsIn(squeeze(typed)) >= MENU_SEARCH_MIN_CHARS;
  // Both are kept per person as well as per firm: what the database returns depends on who asks, and the cache outlives a sign-out in the same tab.
  const found = useQuery({ queryKey: ["menu-search", firmId, userId, term], queryFn: () => searchRecords(firmId as string, term), enabled: !!firmId && !!userId && term !== "" && open, retry: false, staleTime: 10_000 });
  const recent = useQuery({ queryKey: [...RECENT_RECORDS_KEY, firmId, userId], queryFn: () => myRecentRecords(firmId as string), enabled: !!firmId && !!userId && open && !typing, retry: false, staleTime: 0 });

  // A lapsed session signs the person out, as every failed load does (LoadFailed).
  const lapsed = [found.error, recent.error].some((e) => (e as Partial<SearchError> | null)?.unauthenticated);
  useEffect(() => { if (lapsed) void signOut("expired"); }, [lapsed, signOut]);

  if (!firmId) return null;
  // Choosing a result ends the search and closes the menu sheet at phone width, even when the result is the page already shown.
  const finish = () => { end(); setOpenMobile(false); };

  const result = found.data;
  const waiting = typing && !found.isError && (term !== squeeze(typed) || found.isPending);
  const shown = typing && !waiting && !!result && result.query === term;
  const nothing = shown && [result.accounts, result.contacts, result.opportunities, result.quotes].every((g) => g.rows.length === 0);
  const failure = typing && found.isError ? (found.error instanceof SearchError ? found.error.message : "Couldn't search just now. Try again.") : null;

  return (
    <div ref={root} className="relative px-3 pb-2" onKeyDown={(e) => { if (e.key === "Escape" && open) end(); }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/70" aria-hidden="true" />
        <label htmlFor="menu-search" className="sr-only">Search accounts, contacts, opportunities and quotes</label>
        <input
          id="menu-search"
          type="search"
          value={typed}
          autoComplete="off"
          placeholder="Search"
          aria-controls={panel}
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setTyped(e.target.value); setOpen(true); }}
          className="h-10 w-full rounded-md border border-sidebar-border bg-sidebar pl-8 pr-2 text-sm text-sidebar-foreground outline-none ring-sidebar-ring placeholder:text-sidebar-foreground/60 focus-visible:ring-2"
        />
      </div>
      {open && (
        <div id={panel} role="region" aria-label="Search results" aria-live="polite" className="mt-1 max-h-[60vh] overflow-y-auto rounded-md border border-sidebar-border bg-sidebar p-1">
          {!typing && (
            <section aria-label="Recent records">
              <h3 className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70">Recently opened</h3>
              {recent.isPending && <p className="px-2 py-1.5 text-sm text-sidebar-foreground/70">Loading…</p>}
              {recent.isError && <p role="alert" className="px-2 py-1.5 text-sm">Couldn&apos;t load your recent records.</p>}
              {recent.data && recent.data.length === 0 && <p className="px-2 py-1.5 text-sm text-sidebar-foreground/70">Nothing opened yet. Type to search.</p>}
              {recent.data && recent.data.length > 0 && <ul>{recent.data.map((hit) => <Result key={`${hit.kind}-${hit.id}`} hit={hit} showKind onChoose={finish} />)}</ul>}
            </section>
          )}
          {typing && waiting && <p className="px-2 py-1.5 text-sm text-sidebar-foreground/70">Searching…</p>}
          {failure && <p role="alert" className="px-2 py-1.5 text-sm">{failure}</p>}
          {shown && (
            <>
              <Group label="Accounts" group={result.accounts} onChoose={finish} seeAll={{ to: `/accounts?q=${encodeURIComponent(term)}` }} />
              <Group label="Contacts" group={result.contacts} onChoose={finish} />
              <Group label="Opportunities" group={result.opportunities} onChoose={finish} />
              <Group label="Quotes" group={result.quotes} onChoose={finish} />
            </>
          )}
          {nothing && (
            <div className="px-2 py-2">
              <p className="text-sm font-medium">Nothing matches</p>
              <p className="pb-2 text-xs text-sidebar-foreground/70">No account, contact, opportunity or quote holds &ldquo;{term}&rdquo;.</p>
              {!isSupport && <Button type="button" size="sm" className="h-9 rounded-md" onClick={() => setMaking(true)}>New account</Button>}
            </div>
          )}
        </div>
      )}
      {making && !isSupport && (
        <NewAccountDialog
          firmId={firmId}
          person={person}
          initialName={term}
          onClose={() => setMaking(false)}
          onCreated={(account, thenContact) => {
            setMaking(false);
            finish();
            setOpenMobile(false);
            navigate(thenContact ? `/accounts/${account.id}?addContact=1` : `/accounts/${account.id}`);
          }}
        />
      )}
    </div>
  );
}
