import type { Json } from "@/integrations/supabase/types";
import type { AccountEdit, AccountEditable, AccountSource, AccountStatus, ActivityFilter, ChangeRow, OpportunityStage } from "@/lib/accountPageApi";
import { QUOTE_REQUEST_LABELS, type QuoteRequestStatus } from "./quoteRequests";

// The words an account's page says (story CRM-A2.1b): what each status, stage and source is called, how a location, a date and a history entry read, and the
// form's two conversions between what a person types and what the database holds. Words only: who may see or change an account is the database's.

export const STATUS_LABELS: Record<AccountStatus, string> = { prospect: "Prospect", client: "Client" };

/** An opportunity's stage as D-206 words it. */
export const STAGE_LABELS: Record<OpportunityStage, string> = {
  qualifying: "Qualifying",
  intake_under_way: "Intake under way",
  ready_to_send: "Ready to send",
  in_market: "In market",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

/** An account's source as D-211 words it. */
export const SOURCE_LABELS: Record<AccountSource, string> = {
  employer_intake: "Employer's intake",
  added_by_hand: "Added by hand",
  new_quote: "New quote",
  lead: "Lead",
  import: "Import",
};

export const sourceWords = (source: AccountSource, partner: string | null): string =>
  partner ? `${SOURCE_LABELS[source]} · ${partner}` : SOURCE_LABELS[source];

export const quoteStatusLabel = (status: string): string => QUOTE_REQUEST_LABELS[status as QuoteRequestStatus] ?? status;

export const NOT_GIVEN = "Not provided";

/** "Portland, OR" from what the account has; null when it has neither a city nor a state. */
export const locationOf = (a: { city: string | null; state: string | null }): string | null => {
  const parts = [a.city, a.state].filter((p): p is string => !!p && p.trim() !== "");
  return parts.length > 0 ? parts.join(", ") : null;
};

/** The street, then the city, state and postal code, one per line; empty when the account has none of them. */
export const addressLines = (a: { street: string | null; city: string | null; state: string | null; postalCode: string | null }): string[] => {
  const cityLine = [[a.city, a.state].filter((p) => !!p).join(", "), a.postalCode].filter((p) => !!p && p.trim() !== "").join(" ");
  return [a.street, cityLine].filter((l): l is string => !!l && l.trim() !== "");
};

export const employeesWords = (n: number | null): string | null => (n === null ? null : `${n.toLocaleString("en-US")} ${n === 1 ? "employee" : "employees"}`);

/** The first letters of an account's name, for the badge beside it. */
export const initialsOf = (name: string): string => {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** "Oct 29, 2026" for a date ("2026-10-29", read as that day wherever the person is) or a moment (in the person's own time). */
export const formatDay = (iso: string): string => {
  const m = DAY.exec(iso);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

export const formatBytes = (n: number | null): string => {
  if (n === null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const contactName = (c: { firstName: string | null; lastName: string }): string => [c.firstName, c.lastName].filter((p) => !!p && p.trim() !== "").join(" ");

// ---------- the Activity tab ----------

/** What the Activity tab can be narrowed to, in the story's words and order (D-212). The database does the narrowing. */
export const ACTIVITY_FILTERS_SHOWN: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" }, { id: "calls", label: "Calls" }, { id: "notes", label: "Notes" }, { id: "tasks", label: "Tasks" }, { id: "changes", label: "Changes" },
];

/** What each entry of the Activity tab is called. */
export const KIND_LABELS = { change: "Change", call: "Call", note: "Note", task: "Task" } as const;

/** A moment in the person's own time: "Nov 14, 2026, 10:30 AM". The text itself if it is not a date. */
export const formatWhen = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};

/** Today as a day, in the person's own time, to tell a task that is overdue from one that is not. */
export const today = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const FIELD_WORDS: Record<string, string> = {
  owner_id: "owner",
  name: "account name",
  trade_name: "trade name",
  website: "website",
  phone: "phone",
  street: "street",
  city: "city",
  state: "state",
  postal_code: "postal code",
  industry: "industry",
  employees: "employees",
  states_of_operation: "states of operation",
  current_provider: "current provider",
  possible_duplicate_of: "possible duplicate",
  archived_at: "archived",
  account_id: "account",
  first_name: "first name",
  last_name: "last name",
  title: "title",
  email: "email",
  mobile: "mobile",
  is_main: "main contact",
  do_not_email: "do not email",
};

const NOTHING = "nothing";
/** A history value in words: nothing, a list, yes or no, a date, or the text as it is. */
export const valueWords = (v: Json | null): string => {
  if (v === null || v === undefined || v === "") return NOTHING;
  if (Array.isArray(v)) return v.length === 0 ? NOTHING : v.map(String).join(", ");
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
};

/** One history entry as a sentence: "Employees changed from 40 to 45", "Account created", "Elena Marsh added as a contact". */
export function activityWords(row: ChangeRow): string {
  const onContact = row.recordTable === "contacts";
  if (row.kind === "created") return onContact ? `${row.recordName || "A contact"} added as a contact` : "Account created";
  const field = FIELD_WORDS[row.field ?? ""] ?? (row.field ?? "a field").replace(/_/g, " ");
  const text = `${field.charAt(0).toUpperCase()}${field.slice(1)} changed from ${valueWords(row.from)} to ${valueWords(row.to)}`;
  return onContact && row.recordName ? `${row.recordName}: ${text}` : text;
}

// ---------- the edit form ----------

/** What the form holds while it is open: every editable field as text, under the database's column names, so the conflict's comparison lines up with it. */
export type AccountForm = {
  name: string; trade_name: string; website: string; phone: string; street: string; city: string; state: string; postal_code: string;
  industry: string; employees: string; states_of_operation: string; current_provider: string;
};

export const formOf = (a: AccountEditable): AccountForm => ({
  name: a.name,
  trade_name: a.tradeName ?? "",
  website: a.website ?? "",
  phone: a.phone ?? "",
  street: a.street ?? "",
  city: a.city ?? "",
  state: a.state ?? "",
  postal_code: a.postalCode ?? "",
  industry: a.industry ?? "",
  employees: a.employees === null ? "" : String(a.employees),
  states_of_operation: a.statesOfOperation.join(", "),
  current_provider: a.currentProvider ?? "",
});

/** "or, wa  WA" is the list OR, WA: capital letters, each once, in the order typed. */
export const statesOf = (typed: string): string[] => [...new Set(typed.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];

export const editOf = (f: AccountForm): AccountEdit => ({
  name: f.name,
  tradeName: f.trade_name,
  website: f.website,
  phone: f.phone,
  street: f.street,
  city: f.city,
  state: f.state,
  postalCode: f.postal_code,
  industry: f.industry,
  employees: f.employees.trim() === "" ? null : Number(f.employees),
  statesOfOperation: statesOf(f.states_of_operation),
  currentProvider: f.current_provider,
});
