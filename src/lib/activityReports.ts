import { recordActivity } from "@/lib/advisorApi";

/**
 * A file of a submission was downloaded from the console (its census, answers, supplement or application, or a PEO's
 * bundle): one entry in the firm's record, against the submission. Best effort, like every report (recordActivity).
 */
export const recordSubmissionFileDownload = (submissionId: string): void => {
  void recordActivity("document_downloaded", "submission", submissionId);
};
