import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// What the table pages ask the database about column choices and saved views (stories CRM-S3.1b and CRM-S3.4b, D-43;
// 20261117120000_table_settings.sql). The database decides every rule: who reads a view, who changes, shares or unshares
// it, the names and limits. These only put its answers and refusals into the page's shape and words.

/** The tables whose columns and views are kept. A new table is added here when the database's list gains it. */
export type WorkspaceTable = "submissions";

/** One filter, as the table's query reads it: combined with "and". `value` is left out for operators that take none. */
export interface ViewFilter {
  field: string;
  op: string;
  value?: Json;
}

export interface ViewSort {
  field: string;
  direction: "asc" | "desc";
}

export interface SavedView {
  id: string;
  name: string;
  filters: ViewFilter[];
  sort: ViewSort | null;
  /** The view's own columns, in order; null when it has none (the person's choice for the table applies). */
  columns: string[] | null;
  /** Shared with the firm by an owner. */
  shared: boolean;
  /** Saved by the person asking. */
  mine: boolean;
  /** May rename, change and delete it: the person who saved it, and for a shared view only while they are a current owner. */
  canChange: boolean;
  /** May share it (an owner, on a view of their own not yet shared). */
  canShare: boolean;
  /** May stop sharing it (an owner, on any shared view). */
  canUnshare: boolean;
  updatedAt: string;
}

/**
 * Where the columns a person sees came from: their own choice on this saved view, the view's own columns, their own choice
 * for the table, or none kept (the table's defaults, in code).
 */
export type ColumnsSource = "mine_for_view" | "view" | "mine" | "default";

export interface ColumnChoice {
  /** The column keys in order, or null for the table's defaults. */
  columns: string[] | null;
  source: ColumnsSource;
}

type DbError = { code?: string; message?: string };

const NOT_MEMBER = "You aren't a member of this firm.";
const NOT_AVAILABLE = "That view isn't available.";

/**
 * The database words these refusals plainly itself (a name taken, the ceiling, something that can't be kept); anything else gets `fallback`.
 * `locked` says what a refusal of a firm that can't be changed (closing, or a support session: PT423) means for the call, given the database's reason.
 */
function refusal(error: DbError, words: { notAllowed: string; fallback: string; locked?: (why: string) => string }): Error {
  switch (error.code) {
    case "42501": return new Error(words.notAllowed);
    case "PT423": return new Error(words.locked ? words.locked(error.message || "This firm can't be changed") : words.fallback);
    case "PT404": return new Error(NOT_AVAILABLE);
    case "PT409":
    case "PT422":
    case "22023": return new Error(error.message || words.fallback);
    default: return new Error(words.fallback);
  }
}

const asList = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** A table's views the person may open: their own and the firm's shared ones, oldest first. */
export async function listSavedViews(firmId: string, table: WorkspaceTable): Promise<SavedView[]> {
  const { data, error } = await supabase.rpc("list_saved_views", { p_firm_id: firmId, p_table: table });
  if (error) throw refusal(error, { notAllowed: NOT_MEMBER, fallback: "Couldn't load the views." });
  return (data ?? []).map((v) => ({
    id: v.view_id,
    name: v.name,
    filters: asList<ViewFilter>(v.filters),
    sort: (v.sort as unknown as ViewSort | null) ?? null,
    columns: Array.isArray(v.columns) ? (v.columns as string[]) : null,
    shared: v.shared,
    mine: v.mine,
    canChange: v.can_change,
    canShare: v.can_share,
    canUnshare: v.can_unshare,
    updatedAt: v.updated_at,
  }));
}

/** Saves the current filters, sort and columns as the person's own private view. Resolves with its id. */
export async function saveView(input: {
  firmId: string;
  table: WorkspaceTable;
  name: string;
  filters: ViewFilter[];
  sort: ViewSort | null;
  columns: string[] | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_view", {
    p_firm_id: input.firmId,
    p_table: input.table,
    p_name: input.name,
    p_filters: input.filters as unknown as Json,
    p_sort: input.sort as unknown as Json,
    p_columns: input.columns,
  });
  if (error) throw refusal(error, { notAllowed: NOT_MEMBER, fallback: "Couldn't save the view. Try again." });
  return data as string;
}

/** Renames the person's own view. */
export async function renameSavedView(viewId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc("rename_saved_view", { p_view_id: viewId, p_name: name });
  if (error) throw refusal(error, { notAllowed: "Only the person who saved this view can rename it.", fallback: "Couldn't rename the view. Try again." });
}

/** Replaces the person's own view's filters, sort and columns with what the page shows. */
export async function changeSavedView(viewId: string, view: { filters: ViewFilter[]; sort: ViewSort | null; columns: string[] | null }): Promise<void> {
  const { error } = await supabase.rpc("change_saved_view", {
    p_view_id: viewId,
    p_filters: view.filters as unknown as Json,
    p_sort: view.sort as unknown as Json,
    p_columns: view.columns,
  });
  if (error) throw refusal(error, { notAllowed: "Only the person who saved this view can change it.", fallback: "Couldn't change the view. Try again." });
}

/** Deletes the person's own view. Built-in views are not rows and are never deleted. */
export async function deleteSavedView(viewId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_saved_view", { p_view_id: viewId });
  if (error) throw refusal(error, { notAllowed: "Only the person who saved this view can delete it.", fallback: "Couldn't delete the view. Try again." });
}

/** Shares one of the owner's own views with the firm. Owners only. */
export async function shareSavedView(viewId: string): Promise<void> {
  const { error } = await supabase.rpc("share_saved_view", { p_view_id: viewId });
  if (error) throw refusal(error, { notAllowed: "Only an owner of the firm can share a view.", fallback: "Couldn't share the view. Try again." });
}

/** Stops sharing a view; it goes back to being its saver's own. Owners only. */
export async function unshareSavedView(viewId: string): Promise<void> {
  const { error } = await supabase.rpc("unshare_saved_view", { p_view_id: viewId });
  if (error) throw refusal(error, { notAllowed: "Only an owner of the firm can stop sharing a view.", fallback: "Couldn't stop sharing the view. Try again." });
}

const SOURCES: readonly ColumnsSource[] = ["mine_for_view", "view", "mine", "default"];

/** The columns the person sees on a table, or on one saved view of it, and where that choice came from. */
export async function fetchMyColumns(firmId: string, table: WorkspaceTable, viewId: string | null = null): Promise<ColumnChoice> {
  const { data, error } = await supabase.rpc("my_table_columns", { p_firm_id: firmId, p_table: table, p_view_id: viewId });
  if (error) throw refusal(error, { notAllowed: NOT_MEMBER, fallback: "Couldn't load your columns." });
  const found = asList<{ columns: Json | null; source: string }>(data)[0];
  const source = SOURCES.find((s) => s === found?.source);
  if (!found || !source || source === "default" || !Array.isArray(found.columns)) return { columns: null, source: "default" };
  return { columns: found.columns as string[], source };
}

/** Keeps the person's own columns for a table (no view) or for a saved view; null forgets the choice. */
export async function setMyColumns(firmId: string, table: WorkspaceTable, viewId: string | null, columns: string[] | null): Promise<void> {
  const { error } = await supabase.rpc("set_my_table_columns", { p_firm_id: firmId, p_table: table, p_view_id: viewId, p_columns: columns });
  if (error) {
    throw refusal(error, { notAllowed: NOT_MEMBER, fallback: "Couldn't keep your columns. Try again.", locked: (why) => `${why}, so your columns weren't kept.` });
  }
}
