// A firm's record of who did what (story CRM-P2.3; docs/BROKER_CRM_BUILD.md D-16, D-24): what each kind of entry is
// called on screen. The database holds the kinds (public.firm_activity, 20261116160001_firm_activity.sql) and
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
  { value: "firm_signed_up", label: "Signed the firm up" },
  { value: "firm_approved", label: "Approved the firm" },
  { value: "firm_refused", label: "Refused the firm" },
  { value: "invitation_withdrawn", label: "Withdrew an invitation" },
  { value: "member_suspended", label: "Suspended a member" },
  { value: "member_restored", label: "Lifted a member's suspension" },
  { value: "firm_suspended", label: "Suspended the firm" },
  { value: "firm_restored", label: "Lifted the firm's suspension" },
  { value: "member_left", label: "Left the firm" },
  { value: "organisation_listed", label: "Listed an organisation" },
  { value: "organisation_removed", label: "Removed an organisation" },
  { value: "join_asked", label: "Asked to join" },
  { value: "join_declined", label: "Declined a request to join" },
  { value: "closure_asked", label: "Asked to close the firm" },
  { value: "closure_withdrawn", label: "Withdrew the request to close the firm" },
  { value: "closure_stopped", label: "Nevermore stopped the request to close the firm" },
] as const;

export const ENTRY_KIND_VALUES: string[] = ENTRY_KINDS.map((k) => k.value);

/** What an entry's kind is called; a kind this version doesn't know is shown as the database wrote it. */
export const kindLabel = (kind: string): string => ENTRY_KINDS.find((k) => k.value === kind)?.label ?? kind;

/** What an entry is called in the list: its kind, except that the end of a use of support (story CRM-P2.4) is named as the end. */
export const entryLabel = (kind: string, recordType: string): string =>
  kind === "support_access" && recordType === "support_session_end" ? "Nevermore support's access ended" : kindLabel(kind);

// Kept equal to the database's list of record types by src/data/schemaSync.test.ts.
const RECORD_LABELS: Record<string, string> = {
  submission: "Submission",
  document: "Document",
  manuscript: "Packet",
  quote_request: "Quote request",
  membership: "Membership",
  firm: "Firm",
  support_session: "Support session",
  support_session_end: "Support session ended",
  table: "Table",
};

export const RECORD_TYPE_VALUES: string[] = Object.keys(RECORD_LABELS);

export const recordLabel = (recordType: string): string => RECORD_LABELS[recordType] ?? recordType;

// What a browser may report to record_member_activity (a submission opened is not here: the database writes it where it
// hands the submission over): only these pairs of kind and record can happen there, and the
// database refuses any other. Kept equal to the database's list by src/data/schemaSync.test.ts.
export const BROWSER_ACTIVITY = [
  ["document_downloaded", "document"],
  ["document_downloaded", "submission"],
  ["document_downloaded", "quote_request"],
  ["packet_downloaded", "manuscript"],
  ["sign_in", "firm"],
] as const;

export type BrowserActivity = (typeof BROWSER_ACTIVITY)[number];
/** The kinds a browser reports. */
export type BrowserActivityKind = BrowserActivity[0];
/** The record types a browser may report for one kind: a pair the database would refuse doesn't type-check. */
export type BrowserActivityRecord<K extends BrowserActivityKind> = Extract<BrowserActivity, readonly [K, string]>[1];
