import { useQuery } from "@tanstack/react-query";
import type { MergeKind } from "@/data/merge";
import { resolveMergedRecord, type ResolvedRecord } from "@/lib/mergeApi";

/**
 * Asks where a missing record's address leads (story CRM-S4.3a; D-203, D-644, D-662), once, and only while `missing`: the page has been told "not found". The answer is
 * null for an id that was never merged away and for a kept record the person may not see, which read the same as no such record.
 */
export function useMergedAddress(firmId: string | null, kind: MergeKind, id: string, missing: boolean) {
  return useQuery<ResolvedRecord | null>({
    queryKey: ["merged-address", firmId, kind, id],
    queryFn: () => resolveMergedRecord(firmId as string, kind, id),
    enabled: firmId !== null && missing,
    retry: false,
    staleTime: 0,
  });
}
