// A firm's record of who did what (story CRM-P2.3; docs/BROKER_CRM_BUILD.md D-16, D-24): what each kind of entry is
// called on screen. The database holds the kinds (public.firm_activity, 20261116160000_firm_activity.sql) and
// src/data/schemaSync.test.ts keeps this list equal to its check. An entry holds the kind and the id of a record, never
// content, so these are the only words the page has for it.

export const ENTRY_KINDS = [
  { value: "sign_in", label: "Signed in" },
  { value: "submission_viewed", label: "Opened a submission" },
  { value: "document_downloaded", label: "Downloaded a document" },
  { value: "packet_downloaded", label: "Downloaded a packet" },
  { value: "send_recorded", label: "Recorded a send" },
  { value: "member_added", label: "Added a member" },
  { value: "member_ended", label: "Ended a membership" },
  { value: "owner_added", label: "Added an owner" },
  { value: "owner_ended", label: "Ended an owner's membership" },
  { value: "export_made", label: "Exported records" },
  { value: "invitation_sent", label: "Sent an invitation" },
  { value: "member_removed", label: "Removed a member" },
  { value: "support_access", label: "Nevermore support opened your firm's console" },
] as const;

export const ENTRY_KIND_VALUES: string[] = ENTRY_KINDS.map((k) => k.value);

/** What an entry's kind is called; a kind this version doesn't know is shown as the database wrote it. */
export const kindLabel = (kind: string): string => ENTRY_KINDS.find((k) => k.value === kind)?.label ?? kind;

// Kept equal to the database's list of record types by src/data/schemaSync.test.ts.
const RECORD_LABELS: Record<string, string> = {
  submission: "Submission",
  document: "Document",
  manuscript: "Packet",
  quote_request: "Quote request",
  membership: "Membership",
  firm: "Firm",
};

export const RECORD_TYPE_VALUES: string[] = Object.keys(RECORD_LABELS);

export const recordLabel = (recordType: string): string => RECORD_LABELS[recordType] ?? recordType;
