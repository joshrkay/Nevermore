// The bundle link a send to a PEO joins (M-2.1, M-2.2): issued from the same plan as that PEO's download, for the quote request the send made, and
// carrying the certified answers as JSON. One way, shared by the one-PEO composer (SendToPeo) and the send to several PEOs (SendToSeveralPeos).
import { certifiedAnswersDocument } from "@/data/certifiedAnswersDocument";
import { planBundle, type BundleSource } from "@/data/submissionBundle";
import { issueBundleLink, supabaseBundleLinkDeps } from "@/lib/bundleLink";

/** The issueLink a send takes, for one PEO's advisor bundle (its `source`). */
export const peoLinkIssuer = (source: BundleSource) => async (quoteRequestId: number): Promise<{ id: number; token: string }> => {
  const answers = certifiedAnswersDocument({ data: source.intake.data, provenance: source.intake.provenance, submission: source.submission, fileId: source.fileId });
  const issued = await issueBundleLink({ quoteRequestId, plan: planBundle(source), answers }, await supabaseBundleLinkDeps());
  return { id: issued.id, token: issued.token };
};
