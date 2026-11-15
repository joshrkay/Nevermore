import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { mergedNoteWords } from "@/data/mergeWords";
import { resolveMergedRecord, type ResolvedRecord } from "@/lib/mergeApi";
import type { MergeKind } from "@/data/merge";

// The old address of a merged-away account or contact (story CRM-S4.3a; D-203, D-644, D-662). A page that finds "not found" asks `resolve_merged_record`; when it
// answers, the person is sent to the kept record's address, replacing the old one in their history, with a short note saying what happened. The database answers only
// for a record the person may see, so an old address never shows that a record exists to someone who could not have opened it.

/** What the address carries to the kept record's page: the note says where the person came from. */
export interface MergedNoteState {
  mergedInto: string;
}

const addressOf = (r: ResolvedRecord): string => (r.kind === "account" ? `/accounts/${r.id}` : `/contacts/${r.id}`);

/** Asks where a missing record's address leads, once, and only while `missing`. Not asked for an id that is no id (the page has already said so). */
export function useMergedAddress(firmId: string | null, kind: MergeKind, id: string, missing: boolean) {
  return useQuery<ResolvedRecord | null>({
    queryKey: ["merged-address", firmId, kind, id],
    queryFn: () => resolveMergedRecord(firmId as string, kind, id),
    enabled: firmId !== null && missing,
    retry: false,
    staleTime: 0,
  });
}

/** Sends the person to the kept record. */
export const GoToKept = ({ record }: { record: ResolvedRecord }) => <Navigate to={addressOf(record)} replace state={{ mergedInto: record.name } satisfies MergedNoteState} />;

/** The short note on the kept record's page after an old address led there. Nothing when the person came another way. */
export function MergedNote() {
  const state = useLocation().state as Partial<MergedNoteState> | null;
  if (!state?.mergedInto) return null;
  return <p role="status" className="mb-6 rounded-xl border border-border bg-muted/40 p-4 text-sm">{mergedNoteWords(state.mergedInto)}</p>;
}
