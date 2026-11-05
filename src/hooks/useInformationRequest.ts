import { useEffect, useState } from "react";
import { answeredBy, type InformationRequest } from "@/data/informationRequest";
import type { CertificationState } from "@/data/manuscript";
import { readInformationRequest } from "@/lib/informationRequest";

/**
 * The advisor's open request for more information on the intake on screen, until the prospect answers it by
 * certifying again. Only an intake certified at least once can have one, so nothing is read for a draft.
 */
export function useInformationRequest(sessionId: string | null, certification: CertificationState): InformationRequest | null {
  const [read, setRead] = useState<{ sessionId: string; request: InformationRequest | null } | null>(null);
  const certifiedOnce = certification.status !== "none";

  useEffect(() => {
    if (!sessionId || !certifiedOnce) return;
    let cancelled = false;
    void readInformationRequest(sessionId).then((request) => {
      if (!cancelled) setRead({ sessionId, request });
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, certifiedOnce]);

  const request = read && read.sessionId === sessionId ? read.request : null;
  return request && !answeredBy(request, certification) ? request : null;
}
