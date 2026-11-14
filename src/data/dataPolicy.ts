// How Edgar Allan Advisory classifies, keeps and deletes what it holds (US-6.1). This is the policy as the
// product states it: the Privacy page renders it, and docs/DATA_HANDLING.md is the same policy written for
// the advisory team. The database enforces the windows:
//
// * public.intake_draft_retention()       draft expiry      (20261103090000_intake_lifecycle.sql)
// * public.closed_draft_retention()       closed drafts     (20261104092000_data_retention_and_deletion.sql)
// * public.submitted_record_retention()   submitted records (same)
// * public.ops_event_retention()          monitoring events (20261104091000_ops_monitoring.sql)
// * public.email_event_retention()        email delivery    (20261104092000_data_retention_and_deletion.sql)
// * public.firm_activity_retention()     the record of who did what (20261116160001_firm_activity.sql)
// * public.ai_event_retention()           AI call records   (20261103120200_ai_extraction_events.sql)
//
// src/data/schemaSync.test.ts keeps those equal to RETENTION, and dataPolicy.test.ts checks that every table
// and storage bucket the migrations create belongs to a data class below, so nothing new is stored unclassified.
//
// DRAFT (decision D4): the windows are recommended defaults. LEGAL confirms them before launch.

import { BACKUP_MAX_AGE_MS } from "./intakeBackup";
import { DRAFT_RETENTION_DAYS } from "./intakeLifecycle";
import { SOURCE_MAX_AGE_MS } from "./intakeSource";

export type Sensitivity = "restricted" | "confidential" | "internal" | "public";

export interface SensitivityLevel {
  label: string;
  /** What belongs at this level. */
  meaning: string;
  /** How the advisory team handles it. */
  handling: string[];
}

export const SENSITIVITY: Record<Sensitivity, SensitivityLevel> = {
  restricted: {
    label: "Restricted",
    meaning:
      "Personal information about the prospect's employees: who they are, their dates of birth, pay, benefits, dependents and injuries, and anything that holds it (uploaded files, the conversation, the packet).",
    handling: [
      "Only the prospect who provided it and Nevermore's advisors can open it, and the database enforces that.",
      "Never put it in email, chat, tickets, alerts, logs, analytics or a link. Notifications carry named contact fields only.",
      "Stored only in the private database and private storage buckets. Files open through links that expire after 60 seconds.",
      "Dates of birth are masked unless an advisor reveals them for the task at hand, and a packet generated with them revealed is recorded as such.",
      "Don't keep downloaded copies. Delete a downloaded file once the task it was opened for is done.",
    ],
  },
  confidential: {
    label: "Confidential",
    meaning:
      "Business and contact information about the prospect's company and the people who represent it, and the advisory team's own working records about a submission.",
    handling: [
      "Only the prospect and the advisory team can see it.",
      "Internal notification emails may carry the named contact fields (company, signer, title, work email, phone, headcount, state, reference), nothing more.",
      "Shared outside Nevermore only by the prospect, or with the prospect's permission.",
    ],
  },
  internal: {
    label: "Internal",
    meaning:
      "Operational records with no intake content: ids, counts, failure codes and timestamps used to run, monitor and audit the service.",
    handling: [
      "Engineering and admins only.",
      "Safe in a shared engineering channel: it never names a person or quotes an intake.",
    ],
  },
  public: {
    label: "Public",
    meaning: "What the site publishes: marketing copy and the sample packet (invented data).",
    handling: ["Anyone may see it. Keep it accurate and free of anything above this level."],
  },
};

/** Every window, in the units the database states them in. */
export const RETENTION = {
  /** An uncertified draft expires this long after its last change. */
  draftDays: DRAFT_RETENTION_DAYS,
  /** A closed draft (expired, started over, revoked) is deleted this long after it closed. */
  closedDraftDays: 30,
  /** A submitted record is reviewed for deletion this long after its latest certification. */
  submittedYears: 3,
  /** Unsaved answers kept in the prospect's own browser. */
  browserBackupDays: Math.round(BACKUP_MAX_AGE_MS / (24 * 60 * 60 * 1000)),
  /** Held PEO mail nobody assigns (story M-3.3). */
  heldMailDays: 30,
  /** Operational monitoring events. */
  opsEventDays: 90,
  /** A firm's record of who did what: kinds and ids, never content. The window operational events have (D4). */
  firmActivityDays: 90,
  /** Email delivery events (sent, delivered, bounced, complained). */
  emailEventDays: 365,
  /** AI rate-limit records. */
  aiLimitDays: 1,
  /** The record of each AI call: ids, codes and field names, never values. */
  aiEventDays: 90,
  /** How far each intake got, for the pilot funnel: steps and times, never answers. From the intake's start. */
  funnelDays: 365,
  /** The referral and campaign codes of the last tagged link a visitor followed, kept in their own browser. */
  sourceLinkDays: Math.round(SOURCE_MAX_AGE_MS / (24 * 60 * 60 * 1000)),
} as const;

export interface RetentionRule {
  /** What is kept. */
  record: string;
  /** How long. */
  period: string;
  /** What happens at the end of it. */
  then: string;
}

/** The windows a prospect is told about, in the order the Privacy page lists them. */
export const RETENTION_RULES: RetentionRule[] = [
  {
    record: "Draft intakes (never certified), including their answers, conversation and uploaded files",
    period: `${RETENTION.draftDays} days after the last change`,
    then: `The draft expires and can no longer be opened. It is deleted ${RETENTION.closedDraftDays} days later, files and all. Choosing "Start over" closes a draft straight away; it is deleted ${RETENTION.closedDraftDays} days after that.`,
  },
  {
    record: "Submitted records (intakes certified at least once), with their answers, conversation, documents and certification",
    period: `${RETENTION.submittedYears} years after the latest certification`,
    then: "An administrator reviews the record and deletes it, unless a legal obligation requires it to be kept longer. You can ask for it to be deleted sooner.",
  },
  {
    record: "Uploaded documents and the values read from them",
    period: "As long as the intake they belong to",
    then: "Deleted with the intake. While an intake is open you can remove a document yourself at any time.",
  },
  {
    record: "Conversation transcripts with Lenore (typed and voice)",
    period: "As long as the intake they belong to",
    then: "Deleted with the intake.",
  },
  {
    record: "Generated packet PDFs",
    period: "Your download is made in your browser and is not stored by us. Copies our advisors generate are kept as long as the submitted record.",
    then: "Advisor copies are deleted with the submitted record.",
  },
  {
    record: "Unsaved answers kept in your browser while a save is pending",
    period: `Up to ${RETENTION.browserBackupDays} days, in that browser only`,
    then: "Removed from the browser.",
  },
  {
    record: "Email notification records (delivery and bounce events)",
    period: `${RETENTION.emailEventDays} days`,
    then: "Deleted. An address that bounced or reported spam stays on the do-not-send list until you ask us to remove it.",
  },
  {
    record: "Security and operations records (error and failure counts, rate limits)",
    period: `${RETENTION.opsEventDays} days for error records and the record of each AI call; ${RETENTION.aiLimitDays} day for rate limits`,
    then: "Deleted. These never contain your answers.",
  },
  {
    record: "How far each intake got (which steps it reached, such as certifying, and when), used to improve the intake",
    period: `${RETENTION.funnelDays} days after the intake started`,
    then: "Deleted. These never contain your answers, name or email address; if your intake is deleted sooner, these records stay without any link to it.",
  },
  {
    record: "The referral code or campaign tags of the link you arrived by, if it carried any (such as ?ref=… in a link a partner sent you)",
    period: `Up to ${RETENTION.sourceLinkDays} days in your browser; then with your intake, and with the record of how far it got`,
    then: "Removed from the browser, and deleted with those records. Everyone who follows the same link carries the same codes, so they never identify you.",
  },
  {
    record: "Your account (email address, name, company, phone)",
    period: "Until you ask us to delete it",
    then: "Deleted on request, with your intakes.",
  },
];

export interface DataClass {
  id: string;
  label: string;
  sensitivity: Sensitivity;
  /** In the prospect's words. */
  examples: string;
  /** Where it is stored: public tables, storage buckets, and anywhere outside the database. */
  stored: { tables: string[]; buckets: string[]; elsewhere: string[] };
  retention: string;
  deletion: string;
  /**
   * Left off the public Privacy page until counsel has approved the wording for it (docs/LEGAL_REVIEW.md): a class
   * listed here is stored and handled as the rest are, but what people are told about it isn't ours to publish alone.
   */
  awaitingCounsel?: string;
}

const WITH_INTAKE = "Kept with its intake: a draft or a submitted record (see the windows above).";
const DELETED_WITH_INTAKE = "Deleted with its intake by the deletion process (rows and stored files).";

export const DATA_CLASSES: DataClass[] = [
  {
    id: "contact",
    label: "Contact details",
    sensitivity: "confidential",
    examples: "Names, job titles, work email addresses and phone numbers of the people at the company who complete and sign the intake.",
    stored: {
      tables: ["chamber_sessions", "profiles", "chamber_certifications", "outbox_events"],
      buckets: [],
      elsewhere: ["Supabase Auth (the account's email address)", "Resend (the notification emails sent)"],
    },
    retention: `${WITH_INTAKE} Account details until the account is deleted.`,
    deletion: `${DELETED_WITH_INTAKE} The account is deleted separately, on request.`,
  },
  {
    id: "company",
    label: "Company profile",
    sensitivity: "confidential",
    examples: "Legal and trade names, industry, addresses, states of operation, headcount, current PEO or benefits arrangement and target start date.",
    stored: { tables: ["chamber_sessions", "chamber_certifications"], buckets: [], elsewhere: [] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "census",
    label: "Employee census",
    sensitivity: "restricted",
    examples: "Each employee's name, date of birth, job title, pay, employment type, work state, coverage tier and dependents.",
    stored: { tables: ["chamber_sessions", "chamber_certifications", "documents"], buckets: ["documents", "quarantine"], elsewhere: [] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "payroll",
    label: "Payroll",
    sensitivity: "restricted",
    examples: "Pay frequency, payroll provider, annual payroll and uploaded payroll reports or registers.",
    stored: { tables: ["chamber_sessions", "chamber_certifications", "documents"], buckets: ["documents", "quarantine"], elsewhere: [] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "benefits",
    label: "Benefits",
    sensitivity: "restricted",
    examples: "Current plans and carriers, contributions, renewal dates, benefits summaries and invoices (which can list employees and premiums).",
    stored: { tables: ["chamber_sessions", "chamber_certifications", "documents"], buckets: ["documents", "quarantine"], elsewhere: [] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "workers_comp",
    label: "Workers' compensation records",
    sensitivity: "restricted",
    examples: "Class codes, experience modifier, loss runs and claims history, which can describe injuries to named employees.",
    stored: { tables: ["chamber_sessions", "chamber_certifications", "documents"], buckets: ["documents", "quarantine"], elsewhere: [] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "extra_answers",
    label: "Answers to a PEO's own questions",
    sensitivity: "restricted",
    examples: "The prospect's answers to the questions one PEO asks beyond the intake's own, each with the question as it was asked. They go only to that PEO, in its own file, never in the packet or another PEO's files.",
    stored: { tables: ["chamber_sessions", "chamber_certifications"], buckets: [], elsewhere: ["The AI provider, for each message Lenore reads while she asks them (D11)"] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "documents",
    label: "Uploaded documents",
    sensitivity: "restricted",
    examples: "Every file uploaded to an intake, whatever its category, and the values read out of it for review.",
    stored: {
      tables: ["documents"],
      buckets: ["documents", "quarantine"],
      elsewhere: ["The AI provider, for the moment a file is read (D11)", "The malware scanner, for the moment a file is checked (D13)"],
    },
    retention: `${WITH_INTAKE} The prospect can remove a document while the intake is open; while it is certified, the file it was certified with stays for the advisor until the intake is deleted. A file waiting for, or failing, its malware scan is kept in quarantine, where only the service can reach it; once its document is removed, the quarantined file is deleted within five minutes.`,
    deletion: `${DELETED_WITH_INTAKE} The stored file is removed before its row.`,
  },
  {
    id: "transcripts",
    label: "Conversation transcripts",
    sensitivity: "restricted",
    examples: "Everything typed or said to Lenore and her replies, and the quotes that show where each captured answer came from.",
    stored: {
      tables: ["chamber_sessions", "chamber_certifications"],
      buckets: [],
      elsewhere: ["The AI provider, for each message Lenore reads (D11)", "ElevenLabs, for voice conversations (opt-in beta), and through it Anthropic for Lenore's spoken replies (D42)"],
    },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "manuscripts",
    label: "Generated packet PDFs",
    sensitivity: "restricted",
    examples: "The underwriting packet, which carries the census. The prospect's own copy is made in their browser and never stored by us; the advisor-reviewed final version is stored, and the prospect can download it.",
    stored: { tables: ["manuscript_versions"], buckets: ["manuscripts"], elsewhere: ["The prospect's own device (their downloads)"] },
    retention: "Advisor-generated versions are kept with the submitted record.",
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "certification",
    label: "Certification and consent records",
    sensitivity: "confidential",
    examples: "Who certified an intake, their role, when, the exact wording they agreed to and a fingerprint and a copy of the answers as signed; and each agreement to how intake information is used.",
    stored: { tables: ["chamber_certifications", "intake_consents"], buckets: [], elsewhere: [] },
    retention: `Certifications are kept with the submitted record. Consent records are kept until the account is deleted.`,
    deletion: `Certifications: ${DELETED_WITH_INTAKE.toLowerCase()} Consent records go with the account.`,
  },
  {
    id: "advisor_work",
    label: "Advisor review and notes",
    sensitivity: "confidential",
    examples: "Advisors' field reviews and corrections, internal notes, pipeline status and its history, the requests for information sent to the prospect, the PEOs each submission went to with what each quoted and every change to that, and who changed each uploaded document and when.",
    stored: {
      tables: ["advisor_field_reviews", "advisor_review_events", "advisor_notes", "submission_workflow", "submission_status_history", "information_requests", "quote_requests", "quote_request_events", "quote_request_notes", "quote_request_addresses", "quote_request_thread_reads", "document_events"],
      buckets: [],
      elsewhere: [],
    },
    retention: WITH_INTAKE,
    deletion: `${DELETED_WITH_INTAKE} The append-only history can only be removed by that process.`,
  },
  {
    id: "peo_mail",
    label: "PEO correspondence",
    sensitivity: "restricted",
    examples: "Mail a PEO sent to a quote request's reply address, and the advisor's own messages copied to it: who wrote it, when, the plain text, a few headers, and its attachments (a proposal can carry an employer's details and a PEO's pricing). Mail to an address that matched nothing is held until an admin deals with it.",
    stored: { tables: ["quote_request_messages", "quote_request_message_attachments"], buckets: ["peo-mail"], elsewhere: ["Resend"] },
    retention: `${WITH_INTAKE} Held mail nobody assigns is deleted ${RETENTION.heldMailDays} days after it was held (story M-3.3), files first. Resend keeps what it received too, under its own terms, until it is deleted there.`,
    deletion: `${DELETED_WITH_INTAKE} An attachment is stored only once it has been scanned for malware; one the scanner flags is never stored, only its signature.`,
  },
  {
    id: "mailbox_token",
    label: "Advisor mailbox connection",
    sensitivity: "restricted",
    examples: "The permission an advisor or broker gave to send email from their own address: the token that lets Nevermore send, kept encrypted, and the address and provider it is for. It can only send; it never reads a mailbox.",
    stored: { tables: ["broker_mailboxes"], buckets: [], elsewhere: ["Google or Microsoft (the permission itself, which the advisor can withdraw there)"] },
    retention: "Until the advisor disconnects it, the provider revokes it, the advisor leaves (the account is deleted or loses the advisor role), or it is found to carry more than the send permission.",
    deletion: "Deleted at once when any of those happens: the stored token is removed, and Google is asked to revoke it. Not part of an intake: no prospect's data is in it.",
    awaitingCounsel: "The Privacy Policy line on how a broker's mailbox permission is used (Google requires it) is counsel's to word (story M-4.3).",
  },
  {
    id: "notifications",
    label: "Email notifications",
    sensitivity: "confidential",
    examples: "The queued advisor alert and prospect confirmation, delivery and bounce events, and the do-not-send list.",
    stored: { tables: ["outbox_events", "email_delivery_events", "email_suppressions"], buckets: [], elsewhere: ["Resend"] },
    retention: `Queued emails are kept with their intake. Delivery events ${RETENTION.emailEventDays} days. Suppressions until removed on request.`,
    deletion: "Queued emails are deleted with their intake; delivery events by the daily retention job; suppressions by hand.",
  },
  {
    id: "account",
    label: "Accounts and access",
    sensitivity: "confidential",
    examples: "Sign-in accounts (including guest accounts), profiles and advisor or admin roles, the organisations whose members get the advisor role without an admin, and the log of who was granted it and why.",
    stored: { tables: ["profiles", "user_roles", "allowed_organisations", "advisor_role_events"], buckets: [], elsewhere: ["Supabase Auth (email, password hash, sign-in history)"] },
    retention: "Until the account is deleted. Roles are reviewed every quarter (docs/RUNBOOK.md).",
    deletion: "By an admin, on request (docs/DATA_HANDLING.md, 'Deleting an account').",
  },
  {
    id: "audit",
    label: "Lifecycle and deletion records",
    sensitivity: "internal",
    examples: "When a draft expired, was started over or revoked, and every deletion: what was asked, by whom, and how many rows and files were removed.",
    stored: { tables: ["intake_lifecycle_events", "intake_deletions"], buckets: [], elsewhere: [] },
    retention: "Lifecycle records are kept with their intake. Deletion records are kept for good; they hold ids and counts, never intake content.",
    deletion: "Lifecycle records are deleted with their intake. Deletion records are not deleted.",
  },
  {
    id: "operational",
    label: "Operational monitoring and abuse limits",
    sensitivity: "internal",
    examples: "Failure counts and codes (errors, failed uploads, AI failures, refused access), the alerts raised from them, a record of each AI call (ids, codes and the names of the fields it read, never their values), the counters that rate-limit AI use (a one-way hash of the network address, never the address), and the per-year counter that numbers File IDs.",
    stored: {
      tables: ["ops_events", "ops_alerts", "ai_extraction_events", "ai_request_log", "ai_ip_log", "ai_global_usage", "submission_reference_counters"],
      buckets: [],
      elsewhere: ["Supabase and Vercel logs"],
    },
    retention: `Events, AI call records and daily AI totals ${RETENTION.opsEventDays} days; rate-limit records ${RETENTION.aiLimitDays} day; alerts (kind, count and codes only) kept for incident review.`,
    deletion: "By the daily retention jobs. AI call records that point at an intake are also deleted with it.",
  },
  {
    id: "funnel",
    label: "Intake progress (the pilot funnel)",
    sensitivity: "internal",
    examples: "Which steps each intake reached (started, first answer, a document, a census, ready to certify, a verified email, certified, the packet downloaded), when, and when the intake started; and the referral code and campaign tags of the link the intake was started from, as short codes. Never an answer, a name, an address or a document.",
    stored: {
      tables: ["intake_milestones", "chamber_sessions"],
      buckets: [],
      elsewhere: [`The visitor's own browser: the codes of the last tagged link they followed, for up to ${RETENTION.sourceLinkDays} days`],
    },
    retention: `${RETENTION.funnelDays} days from the intake's start, a whole start date at once.`,
    deletion: "By the daily retention job. Deleting an intake removes its link to these records; the steps, times and source codes stay, unattached, so the funnel still counts it. The codes on the intake itself go with it.",
  },
  {
    id: "referral_partners",
    label: "Referral partners",
    sensitivity: "confidential",
    examples: "The people and firms who refer employers to us: their name, what kind of partner they are, the code in the link they share, and which advisor added or last changed them.",
    stored: { tables: ["referral_partners"], buckets: [], elsewhere: [] },
    retention: "Kept while we work with the partner, so the codes on past intakes still name them.",
    deletion: "By an admin, on the partner's request or when we stop working with them (docs/DATA_HANDLING.md).",
  },
  {
    id: "peo_requirement_profiles",
    label: "PEOs and their requirement profiles",
    sensitivity: "confidential",
    examples: "The PEOs we prepare packets for and what each asks for, version by version: the answers and documents it needs, its census columns, its eligibility rules, its own questions, and where and when that was checked; and the names, roles, work emails and phones of the people at each PEO we deal with.",
    stored: { tables: ["peos", "peo_profile_versions", "peo_contacts"], buckets: [], elsewhere: [] },
    retention: "For good: a published profile version never changes, so a packet can always be read against what the PEO asked for at the time. A PEO contact stays with the version that names them.",
    deletion: "Nothing about an intake is in them, so deleting an intake leaves them. A PEO contact who asks to be removed is removed by hand (docs/DATA_HANDLING.md).",
  },
  {
    id: "peo_census_templates",
    label: "PEO template workbooks",
    sensitivity: "confidential",
    examples: "The blank census spreadsheet a PEO asks to have filled, as an admin uploaded it, with its file name, size, hash and virus-check result. Nothing about an intake: the census is written into a copy in the browser of whoever downloads it.",
    stored: { tables: ["peo_census_templates"], buckets: ["peo-templates", "quarantine"], elsewhere: ["The malware scanner, while it checks an upload (docs/adr/0002)"] },
    retention: "For good, as the profile versions that name them are, so a census can always be filled as the PEO asked at the time. A blocked one stays in quarantine for incident review.",
    deletion: "Nothing about an intake is in them, so deleting an intake leaves them. A template is removed by hand if a PEO asks (docs/DATA_HANDLING.md).",
  },
  {
    id: "firms_and_members",
    label: "Firms, teams and who belongs to them",
    sensitivity: "confidential",
    examples: "A brokerage's name and address in the web address, who sees its records, its teams, and which accounts are members of it, in what role and from and until when, and which members are suspended and since when. Nothing about an intake's answers.",
    stored: { tables: ["firms", "firm_teams", "firm_memberships", "firm_member_suspensions"], buckets: [], elsewhere: [] },
    retention: "For good: a membership is never changed, only ended, so who could see a record on a given day can always be answered.",
    deletion: "A member's account deleted at their request removes their memberships; a firm's last current owner can't be removed. Closing a firm is built in a later story (docs/DATA_HANDLING.md).",
  },
  {
    id: "firm_invitations",
    label: "Invitations to join a firm",
    sensitivity: "confidential",
    examples: "The email address an owner invited, the role offered, when it was made, resent, accepted or withdrawn and by whom, and whether the email went out. The link's token is never kept, only a hash of it. Nothing about an intake.",
    stored: { tables: ["firm_invitations"], buckets: [], elsewhere: ["Resend, which sends the invitation email (the address and the link, once)"] },
    retention: "Kept with the firm, as the record of how a person joined: an accepted or withdrawn invitation stays, and one never used stays until an owner withdraws it. A rule to clear old ones is not built yet (docs/DATA_HANDLING.md).",
    deletion: "A member's account deleted at their request clears who invited or accepted from the invitations that name it; the invited email address stays until a later story clears expired invitations (docs/DATA_HANDLING.md).",
  },
  {
    id: "firm_activity",
    label: "A firm's record of who did what",
    sensitivity: "internal",
    examples: "For each firm, who did what and when: a sign-in to the firm's console, a submission opened, a file downloaded, a send recorded, an export, an invitation, a removal, support access, and every change to who belongs to the firm and in what role. The kind of thing and the id of the record only: never an answer, a name, an email's text or a file's contents.",
    stored: { tables: ["firm_activity"], buckets: [], elsewhere: [] },
    retention: `${RETENTION.firmActivityDays} days, the window for operational events (D4); no one can change or delete an entry before then, an admin included. The window is a draft (D4): counsel may ask for longer.`,
    deletion: "Only by the daily retention job (prune_firm_activity), which removes entries past the window and nothing else. A firm's owners read their own firm's record; no one else does, platform admins included; an entry made by a platform admin from outside the firm reads as \"Nevermore\" (no name, email or id), D-33.",
  },
];

/** The classes a table or bucket belongs to. */
export function classesStoredIn(where: { table?: string; bucket?: string }): DataClass[] {
  return DATA_CLASSES.filter(
    (c) => (where.table !== undefined && c.stored.tables.includes(where.table)) || (where.bucket !== undefined && c.stored.buckets.includes(where.bucket)),
  );
}
