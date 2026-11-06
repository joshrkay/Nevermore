import { MailQuestion } from "lucide-react";
import type { InformationRequest } from "@/data/informationRequest";
import { FIELD_LABELS } from "@/data/provenance";

interface InformationRequestNoticeProps {
  request: InformationRequest;
  /** Opens Review, where every answer can be confirmed or changed. */
  onOpenReview: () => void;
}

const when = (iso: string) => new Date(iso).toLocaleDateString([], { month: "long", day: "numeric" });

/**
 * The advisor's open request for more information, in their words, with the answers it is about. It stays until
 * the prospect certifies again, which answers it (or the advisor moves on). The email they were sent says the same.
 */
const InformationRequestNotice = ({ request, onOpenReview }: InformationRequestNoticeProps) => (
  <section
    aria-labelledby="information-request-notice"
    className="border-b border-warning/40 bg-warning/10 px-4 py-3 text-sm"
  >
    <h2 id="information-request-notice" className="flex items-center gap-1.5 font-medium">
      <MailQuestion className="w-4 h-4 shrink-0 text-warning" aria-hidden="true" />
      Your advisor asked for more information on {when(request.requestedAt)}
    </h2>
    <p className="mt-1 whitespace-pre-wrap">{request.message}</p>
    {request.fields.length > 0 && (
      <p className="mt-1 text-xs text-muted-foreground">
        About: {request.fields.map((f) => FIELD_LABELS[f]).join(", ")}
      </p>
    )}
    <p className="mt-2 text-xs text-muted-foreground">
      Update your answers, then certify again on the Certify & sign tab; that sends them to your advisor. If nothing
      needs to change, reply to the email we sent you.{" "}
      <button
        type="button"
        onClick={onOpenReview}
        className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors"
      >
        Open Review
      </button>
    </p>
  </section>
);

export default InformationRequestNotice;
