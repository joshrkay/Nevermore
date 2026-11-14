import type { TableFields, TableFilter, TableSort } from "@/lib/tableQuery";
import { has } from "./has";
import { OPERATORS, type OperatorShape } from "./operators";
import {
  FILTER_DAYS_MAX, FILTER_LIST_MAX, FILTER_TEXT_MAX, MAX_TABLE_PAGE, TABLE_FILTER_LIMIT, type TableDefinition,
} from "./columns";

// The table address (story CRM-S3.5a, D-43): the whole state of a table is in the page's address, so a bookmark, a shared link,
// a new tab and the Back button all show the same rows. One pair of functions reads and writes it for every table; no table
// writes its own. docs/BROKER_CRM_BUILD.md ("The table address") lists each parameter. In short:
//
//   page=3                          the page, from 2 (page 1 has no parameter)
//   sort=-submitted_at              one field; a leading "-" means newest or largest first
//   filter=needs_action:is:true     one filter a parameter, repeated: field:operator:value, written in one fixed order
//   filter=states:any_of:CA,NY      a list's values are joined by commas
//   view=won                        a built-in view's id, or a saved view's id (CRM-S3.4a)
//   q=acme                          the search
//
// In a filter a backslash keeps a ":", a "," or a "\" (in the field, the operator or a value) from being read as a separator.
//
// The codec is total: for any address, and any text typed into the search box, it returns an address and never throws. What it
// can't read is dropped and the page rewrites the address cleanly. What it can't JUDGE yet (a saved view or a custom field the
// definition has not loaded) is kept as written until the definition says it is ready. The database refuses a filter it doesn't
// take, with its reason; the codec drops only what it can't read at all or what the database would refuse for its shape.

export interface TableAddress<K extends TableFields> {
  /** From 1. */
  page: number;
  sort: TableSort<keyof K & string> | null;
  /** The filters the codec could read and the table knows, in one canonical order. */
  filters: TableFilter<K>[];
  /** A built-in view's id or a saved view's id; null is the table's "All". */
  view: string | null;
  /** What is searched for, already long enough to search (empty means no search). */
  search: string;
  /** What the table can't judge yet (its views or fields are still loading), kept exactly as written. Empty when everything is known. */
  held: { view: string | null; sort: string | null; filters: string[] };
}

/** The parameter names, once. */
export const ADDRESS_PARAMS = { page: "page", sort: "sort", filter: "filter", view: "view", search: "q" } as const;

/** What the codec threw away, for the one plain line the frame says when a table could not load its views or fields. */
export interface Dropped {
  view: string | null;
  filterFields: string[];
}


// ---- text: always well formed, counted in characters ----
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;
/**
 * Text the address can write and the database can take: no half of a character left in it (a lone surrogate would make the address
 * impossible to write) and no NUL (U+0000, which Postgres text cannot hold: it fails the call with 22P05, a failure that is no
 * refusal and no retry can mend). Other control characters the database treats as any other character, so they stay.
 */
const wellFormed = (s: string) => s.replace(LONE_SURROGATE, "\ufffd").split("\u0000").join("");
/** The most characters (code points, as the database counts them) of a piece of text; never cuts a character in two. */
const cut = (s: string, max: number) => {
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join("") : s;
};
const length = (s: string) => Array.from(s).length;

// ---- escaping: a backslash keeps ":" and "," (and itself) from being read as separators ----
export const escapeText = (s: string) => s.replace(/[\\:,]/g, (c) => `\\${c}`);
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
/** A text value as the database reads it: trimmed, not empty, at most 200 characters. */
const textValue = (raw: string): string | undefined => {
  const t = wellFormed(unescapeText(raw)).trim();
  return t !== "" && length(t) <= FILTER_TEXT_MAX ? t : undefined;
};

/** The value a filter's text holds for an operator of this shape, or undefined when it is not one. The filter row's editor checks what is typed with this same function, so it takes exactly what the address does. */
export function readValue(shape: OperatorShape, raw: string | undefined): unknown {
  if (shape === "none") return raw === undefined ? null : undefined;
  if (raw === undefined) return undefined;
  switch (shape) {
    case "text": return textValue(raw);
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
      return n !== null && Number.isInteger(n) && n >= 0 && n <= FILTER_DAYS_MAX ? n : undefined;
    }
    case "list": {
      const items = splitOn(raw, ",").map(textValue);
      return items.length >= 1 && items.length <= FILTER_LIST_MAX && items.every((v) => v !== undefined) ? items : undefined;
    }
    case "bool": return raw === "true" ? true : raw === "false" ? false : undefined;
  }
}

type Read<K extends TableFields> = { ok: TableFilter<K> } | { unknownField: string } | { bad: true };

/** One filter from its parameter: the filter, or the name of a field the table doesn't know, or that it can't be read. */
function readFilter<K extends TableFields>(table: TableDefinition<K, never, never>, text: string): Read<K> {
  const parts = splitOn(text, ":");
  if (parts.length < 2 || parts.length > 3) return { bad: true };
  const [rawField, rawOp, raw] = parts;
  const field = unescapeText(rawField);
  const op = unescapeText(rawOp);
  if (field === "") return { bad: true };
  if (!has(table.fields, field)) return { unknownField: field };
  const ops = OPERATORS[table.fields[field as keyof K & string].kind];
  const shape = has(ops, op) ? ops[op].shape : undefined;
  if (!shape) return { bad: true };
  const value = readValue(shape, raw);
  if (value === undefined) return { bad: true };
  return { ok: (value === null ? { field, op } : { field, op, value }) as unknown as TableFilter<K> };
}

const writeValue = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? escapeText(v) : String(v))).join(",");
  return typeof value === "string" ? escapeText(value) : String(value);
};
/** One filter as the address writes it (`field:operator:value`): also its key, since two equal filters are one. */
export const writeFilter = (f: { field: string; op: string; value?: unknown }): string => {
  const value = writeValue(f.value);
  return value === null ? `${escapeText(f.field)}:${escapeText(f.op)}` : `${escapeText(f.field)}:${escapeText(f.op)}:${value}`;
};

/** A sort parameter read against the table's fields: the sort, or the text when it names a field the table doesn't know. */
function readSort<K extends TableFields>(table: TableDefinition<K, never, never>, text: string | null): { sort: TableSort<keyof K & string> } | { unknown: string } | null {
  if (!text) return null;
  const direction = text.startsWith("-") ? "desc" : "asc";
  const field = text.replace(/^-/, "");
  if (field === "") return null;
  return has(table.fields, field) ? { sort: { field: field as keyof K & string, direction } } : { unknown: text };
}

/** The table's search for what was typed or linked: trimmed, whole characters only, at most 200, and nothing at all until it is long enough. */
export function searchTermFor(typed: string, minChars: number): string {
  const text = cut(wellFormed(typed).trim(), FILTER_TEXT_MAX).trim();
  return text.replace(/\s+/g, "").length >= minChars ? text : "";
}

/** The filters a view stands for (none for no view, or for a view the table doesn't know). */
export function viewFilters<K extends TableFields>(table: TableDefinition<K, never, never>, viewId: string | null): TableFilter<K>[] {
  return table.views.find((v) => v.id === viewId)?.filters ?? [];
}

/**
 * The filters the database is asked for under a view: the view's own, always counted first, then the address's, of which only as
 * many as the table's limit leaves room for (the codec drops the rest and rewrites the address, so this seldom cuts).
 */
export function effectiveFilters<K extends TableFields>(table: TableDefinition<K, never, never>, viewId: string | null, addressFilters: TableFilter<K>[]): TableFilter<K>[] {
  const own = viewFilters(table, viewId);
  return [...own, ...addressFilters.slice(0, Math.max(0, TABLE_FILTER_LIMIT - own.length))];
}

/** What a table's page asks the database: the one query an address stands for. Rows and counts are both read from it. */
export interface TableQuery<K extends TableFields> {
  filters: TableFilter<K>[];
  sort: TableSort<keyof K & string> | null;
  page: number;
  search: string;
}

/** The effective query of an address: the view's filters and the address's together, the sort, the page and the search. */
export function queryFor<K extends TableFields>(table: TableDefinition<K, never, never>, address: TableAddress<K>): TableQuery<K> {
  return { filters: effectiveFilters(table, address.view, address.filters), sort: address.sort, page: address.page, search: address.search };
}

/** Whether the address holds anything the table can't judge yet: the rows wait until it can. */
export const hasHeld = <K extends TableFields>(address: TableAddress<K>): boolean =>
  address.held.view !== null || address.held.sort !== null || address.held.filters.length > 0;

/** The address a table is at, from the page's search parameters, and what was dropped to read it. Never throws. */
export function judgeAddress<K extends TableFields>(table: TableDefinition<K, never, never>, params: URLSearchParams): { address: TableAddress<K>; dropped: Dropped } {
  const pageNumber = Number(params.get(ADDRESS_PARAMS.page));
  const page = Number.isInteger(pageNumber) && pageNumber >= 2 && pageNumber <= MAX_TABLE_PAGE ? pageNumber : 1;
  const viewsLoading = table.viewsStatus === "loading";
  const fieldsLoading = table.fieldsStatus === "loading";
  const held: TableAddress<K>["held"] = { view: null, sort: null, filters: [] };
  const dropped: Dropped = { view: null, filterFields: [] };

  const viewParam = params.get(ADDRESS_PARAMS.view);
  let view: string | null = null;
  if (viewParam) {
    if (table.views.some((v) => v.id === viewParam)) view = viewParam;
    else if (viewsLoading) held.view = viewParam;
    else dropped.view = viewParam;
  }

  let sort: TableSort<keyof K & string> | null = null;
  const sortRead = readSort(table, params.get(ADDRESS_PARAMS.sort));
  if (sortRead && "sort" in sortRead) sort = sortRead.sort;
  else if (sortRead && "unknown" in sortRead && fieldsLoading) held.sort = sortRead.unknown;

  // A sort equal to the table's own default is no sort: the address never holds it, so the order line and its way back don't show for it.
  if (sort && table.defaultSort && sort.field === table.defaultSort.field && sort.direction === table.defaultSort.direction) sort = null;

  // The view's filters count first against the table's limit; the address takes the room that is left (held ones count too).
  const room = Math.max(0, TABLE_FILTER_LIMIT - viewFilters(table, view).length);
  const known: { text: string; filter: TableFilter<K> }[] = [];
  const add = (filter: TableFilter<K>) => {
    const text = writeFilter(filter);
    if (known.length + held.filters.length < room && !known.some((k) => k.text === text)) known.push({ text, filter });
  };
  for (const text of params.getAll(ADDRESS_PARAMS.filter)) {
    const read = readFilter(table, text);
    if ("ok" in read) add(read.ok);
    else if ("unknownField" in read) {
      if (fieldsLoading) {
        if (known.length + held.filters.length < room && !held.filters.includes(text)) held.filters.push(text);
      } else dropped.filterFields.push(read.unknownField);
    }
  }

  // Old links, mapped onto the same shape: they fill in what the new parameters left empty and never override them. A field the new
  // address already filters on keeps the new filter.
  const old = table.legacy?.(params);
  if (old) {
    if (!view && !held.view && old.view && table.views.some((v) => v.id === old.view)) view = old.view;
    if (!sort && !held.sort && old.sort && has(table.fields, old.sort.field)) sort = old.sort;
    for (const filter of old.filters ?? []) {
      if (!known.some((k) => (k.filter as { field: string }).field === (filter as { field: string }).field)) add(filter);
    }
  }
  // One canonical order, so the same filters are one address, one key and one bookmark whatever order they were written in.
  known.sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  held.filters.sort();

  return {
    address: {
      page,
      sort,
      filters: known.map((k) => k.filter),
      view,
      search: searchTermFor(params.get(ADDRESS_PARAMS.search) ?? "", table.searchMinChars),
      held,
    },
    dropped,
  };
}

/** The address a table is at, from the page's search parameters. Never throws: what can't be read is dropped. */
export const readAddress = <K extends TableFields>(table: TableDefinition<K, never, never>, params: URLSearchParams): TableAddress<K> => judgeAddress(table, params).address;

/** The search parameters that say this address, in one fixed order, with nothing in them that is a default. Never throws. */
export function addressToSearch<K extends TableFields>(address: TableAddress<K>): string {
  // Written by hand rather than by URLSearchParams so the colons and commas stay readable; the browser reads both the same way.
  const part = (key: string, value: string) => `${key}=${encodeURIComponent(wellFormed(value)).replace(/%3A/gi, ":").replace(/%2C/gi, ",").replace(/%20/g, "+")}`;
  const out: string[] = [];
  const view = address.view ?? address.held.view;
  if (view) out.push(part(ADDRESS_PARAMS.view, view));
  if (address.search) out.push(part(ADDRESS_PARAMS.search, address.search));
  const filters = [...address.filters.map((f) => writeFilter(f)), ...address.held.filters].sort();
  for (const f of filters) out.push(part(ADDRESS_PARAMS.filter, f));
  const sort = address.sort ? `${address.sort.direction === "desc" ? "-" : ""}${address.sort.field}` : address.held.sort;
  if (sort) out.push(part(ADDRESS_PARAMS.sort, sort));
  if (address.page > 1) out.push(part(ADDRESS_PARAMS.page, String(address.page)));
  return out.join("&");
}

/** Whether two addresses are the same place: the same page, sort, filters, view and search (S3.4a asks this to tell a view that was modified). */
export const sameAddress = <K extends TableFields>(a: TableAddress<K>, b: TableAddress<K>): boolean => addressToSearch(a) === addressToSearch(b);

/** What can change in an address: any part but `held`, and, for the filter row, which held filters stay (`heldFilters`, as written in the address). */
export type AddressChange<K extends TableFields> = Partial<Omit<TableAddress<K>, "held">> & { heldFilters?: string[] };

/**
 * The address after a change. Anything other than the page going to another page (a filter, the sort, the view, the search)
 * starts again from the first page, always: the rows under the old page number mean nothing under the new question (CRM-S3.5).
 */
export function changeAddress<K extends TableFields>(address: TableAddress<K>, change: AddressChange<K>): TableAddress<K> {
  const onlyThePage = Object.keys(change).every((k) => k === "page");
  const { heldFilters, ...rest } = change;
  const next = { ...address, ...rest, held: { ...address.held } };
  if (!onlyThePage) next.page = 1;
  // A view or sort a person chose replaces the one that was held.
  if ("view" in change) next.held.view = null;
  if ("sort" in change) next.held.sort = null;
  // A caller that states the whole filter list (a checkbox, a removed chip, "Clear filters") replaces the held filters too.
  if ("filters" in change) next.held.filters = [];
  // The filter row keeps (or removes one of) the filters held for fields that have not loaded, by saying which ones are left.
  if (heldFilters) next.held.filters = [...heldFilters].sort();
  return next;
}
