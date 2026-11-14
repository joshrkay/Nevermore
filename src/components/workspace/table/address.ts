import type { TableFields, TableFilter, TableSort } from "@/lib/tableQuery";
import { MAX_PAGE, type TableDefinition } from "./columns";

// The table address (story CRM-S3.5a, D-43): the whole state of a table is in the page's address, so a bookmark, a shared link,
// a new tab and the Back button all show the same rows. One pair of functions reads and writes it for every table; no table
// writes its own. docs/BROKER_CRM_BUILD.md ("The table address") lists each parameter. In short:
//
//   page=3                          the page, from 2 (page 1 has no parameter)
//   sort=-submitted_at              one field; a leading "-" means newest or largest first
//   filter=needs_action:is:true     one filter a parameter, repeated: field:operator:value
//   filter=states:any_of:CA,NY      a list's values are joined by commas; a "\" before \: \, or \\ keeps them as text
//   view=won                        a built-in view's id, or a saved view's id (CRM-S3.4a)
//   q=acme                          the search
//
// An address nobody wrote with care (bookmarked, edited by hand, stale, garbage) must never crash: what can't be understood is
// dropped, and the page rewrites the address cleanly. The database refuses a filter it doesn't take, with its reason (22023);
// the frame drops here only what it can't read at all, never what the database would refuse by name.

export interface TableAddress<K extends TableFields> {
  /** From 1. */
  page: number;
  sort: TableSort<keyof K & string> | null;
  filters: TableFilter<K>[];
  /** A built-in view's id or a saved view's id; null is the table's "All". */
  view: string | null;
  /** What is searched for, already long enough to search (empty means no search). */
  search: string;
}

/** The parameter names, once. */
export const ADDRESS_PARAMS = { page: "page", sort: "sort", filter: "filter", view: "view", search: "q" } as const;

const MAX_FILTERS = 20;
const MAX_SEARCH = 200;
const MAX_TEXT = 200;
const MAX_LIST = 100;
const MAX_COUNT_OF_DAYS = 3660;

type Shape = "none" | "text" | "number" | "numbers" | "day" | "days" | "count" | "list" | "bool";

/** The operators of each kind of field and the shape of the value each takes: the same operators `src/lib/tableQuery.ts` types. */
const OPERATORS: Record<string, Record<string, Shape>> = {
  text: { contains: "text", is: "text", is_empty: "none" },
  number: { is: "number", more_than: "number", less_than: "number", between: "numbers" },
  date: { on: "day", before: "day", after: "day", between: "days", in_next_days: "count", in_last_days: "count" },
  choice: { any_of: "list", none_of: "list", is_empty: "none" },
  choices: { any_of: "list", none_of: "list", is_empty: "none" },
  yes_no: { is: "bool" },
  person: { any_of: "list", me: "none", my_team: "none" },
};

// ---- text escaping: a backslash keeps ":" and "," (and itself) from being read as separators ----
const escapeText = (s: string) => s.replace(/[\\:,]/g, (c) => `\\${c}`);
const unescapeText = (s: string) => s.replace(/\\([\\:,])/g, "$1");
/** Splits on a separator that is not escaped, leaving the pieces' escapes in place. */
function splitOn(s: string, sep: ":" | ","): string[] {
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      current += c + s[i + 1];
      i++;
    } else if (c === sep) {
      parts.push(current);
      current = "";
    } else current += c;
  }
  parts.push(current);
  return parts;
}

const isDay = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const asNumber = (s: string): number | null => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null);

/** The value a filter's text holds for an operator of this shape, or undefined when it is not one. */
function readValue(shape: Shape, raw: string | undefined): unknown {
  if (shape === "none") return raw === undefined ? null : undefined;
  if (raw === undefined) return undefined;
  switch (shape) {
    case "text": {
      const t = unescapeText(raw);
      return t !== "" && t.length <= MAX_TEXT ? t : undefined;
    }
    case "number": return asNumber(raw) ?? undefined;
    case "numbers": {
      const parts = splitOn(raw, ",").map(asNumber);
      return parts.length === 2 && parts.every((n) => n !== null) ? parts : undefined;
    }
    case "day": return isDay(raw) ? raw : undefined;
    case "days": {
      const parts = splitOn(raw, ",");
      return parts.length === 2 && parts.every(isDay) ? parts : undefined;
    }
    case "count": {
      const n = asNumber(raw);
      return n !== null && Number.isInteger(n) && n >= 0 && n <= MAX_COUNT_OF_DAYS ? n : undefined;
    }
    case "list": {
      const items = splitOn(raw, ",").map(unescapeText);
      return items.length >= 1 && items.length <= MAX_LIST && items.every((v) => v !== "" && v.length <= MAX_TEXT) ? items : undefined;
    }
    case "bool": return raw === "true" ? true : raw === "false" ? false : undefined;
  }
}

/** One filter from its parameter, or null when it names no field of the table, no operator of its kind, or a value it can't hold. */
function readFilter<K extends TableFields>(fields: K, text: string): TableFilter<K> | null {
  const parts = splitOn(text, ":");
  if (parts.length < 2 || parts.length > 3) return null;
  const [field, op, raw] = parts;
  const kind = Object.prototype.hasOwnProperty.call(fields, field) ? fields[field] : undefined;
  if (!kind) return null;
  const ops = OPERATORS[kind];
  const shape = Object.prototype.hasOwnProperty.call(ops, op) ? ops[op] : undefined;
  if (!shape) return null;
  const value = readValue(shape, raw);
  if (value === undefined) return null;
  return (value === null ? { field, op } : { field, op, value }) as unknown as TableFilter<K>;
}

const writeValue = (value: unknown): string | null => {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? escapeText(v) : String(v))).join(",");
  return typeof value === "string" ? escapeText(value) : String(value);
};
const writeFilter = (f: { field: string; op: string; value?: unknown }): string => {
  const value = writeValue(f.value);
  return value === null ? `${f.field}:${f.op}` : `${f.field}:${f.op}:${value}`;
};

const sameFilter = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

/** The text of a sort parameter ("-field" is descending) read against the table's fields, or null. */
function readSort<K extends TableFields>(fields: K, text: string | null): TableSort<keyof K & string> | null {
  if (!text) return null;
  const direction = text.startsWith("-") ? "desc" : "asc";
  const field = text.replace(/^-/, "");
  return Object.prototype.hasOwnProperty.call(fields, field) ? { field: field as keyof K & string, direction } : null;
}

/** The table's search for what was typed or linked: trimmed, and nothing at all until it is long enough. */
export function searchTermFor(typed: string, minChars: number): string {
  const text = typed.trim().slice(0, MAX_SEARCH).trim();
  return text.replace(/\s+/g, "").length >= minChars ? text : "";
}

/** The address a table is at, from the page's search parameters. Never throws: what can't be read is dropped. */
export function readAddress<K extends TableFields, Row>(table: TableDefinition<K, Row>, params: URLSearchParams): TableAddress<K> {
  const pageNumber = Number(params.get(ADDRESS_PARAMS.page));
  const page = Number.isInteger(pageNumber) && pageNumber >= 2 && pageNumber <= MAX_PAGE ? pageNumber : 1;

  const viewParam = params.get(ADDRESS_PARAMS.view);
  let view = viewParam && table.isView(viewParam) ? viewParam : null;
  let sort = readSort(table.fields, params.get(ADDRESS_PARAMS.sort));
  const filters: TableFilter<K>[] = [];
  for (const text of params.getAll(ADDRESS_PARAMS.filter)) {
    const filter = readFilter(table.fields, text);
    if (filter && !filters.some((f) => sameFilter(f, filter))) filters.push(filter);
  }

  // Old links, mapped onto the same shape: they fill in what the new parameters left empty and never override them.
  const old = table.legacy?.(params);
  if (old) {
    if (!view && old.view && table.isView(old.view)) view = old.view;
    if (!sort && old.sort && Object.prototype.hasOwnProperty.call(table.fields, old.sort.field)) sort = old.sort;
    for (const filter of old.filters ?? []) if (!filters.some((f) => sameFilter(f, filter))) filters.push(filter);
  }

  return {
    page,
    sort,
    filters: filters.slice(0, MAX_FILTERS),
    view,
    search: searchTermFor(params.get(ADDRESS_PARAMS.search) ?? "", table.searchMinChars),
  };
}

/** The search parameters that say this address, in one fixed order, with nothing in them that is a default. */
export function addressToSearch<K extends TableFields>(address: TableAddress<K>): string {
  // Written by hand rather than by URLSearchParams so the colons and commas stay readable; the browser reads both the same way.
  const part = (key: string, value: string) => `${key}=${encodeURIComponent(value).replace(/%3A/gi, ":").replace(/%2C/gi, ",").replace(/%20/g, "+")}`;
  const out: string[] = [];
  if (address.view) out.push(part(ADDRESS_PARAMS.view, address.view));
  if (address.search) out.push(part(ADDRESS_PARAMS.search, address.search));
  for (const f of address.filters) out.push(part(ADDRESS_PARAMS.filter, writeFilter(f)));
  if (address.sort) out.push(part(ADDRESS_PARAMS.sort, `${address.sort.direction === "desc" ? "-" : ""}${address.sort.field}`));
  if (address.page > 1) out.push(part(ADDRESS_PARAMS.page, String(address.page)));
  return out.join("&");
}

/**
 * The address after a change. Anything other than the page going to another page (a filter, the sort, the view, the search)
 * starts again from the first page: the rows under the old page number mean nothing under the new question (CRM-S3.5).
 */
export function changeAddress<K extends TableFields>(address: TableAddress<K>, change: Partial<TableAddress<K>>): TableAddress<K> {
  const onlyThePage = Object.keys(change).every((k) => k === "page");
  const next = { ...address, ...change };
  if (!onlyThePage) next.page = change.page && change.page > 1 ? change.page : 1;
  return next;
}
