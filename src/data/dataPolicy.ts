// How Edgar Allan Advisory classifies, keeps and deletes what it holds (US-6.1). This is the policy as the
// product states it: the Privacy page renders it, and docs/DATA_HANDLING.md is the same policy written for
// the advisory team. The database enforces the windows:
//
// * public.intake_draft_retention()       draft expiry      (20261103090000_intake_lifecycle.sql)
// * public.closed_draft_retention()       closed drafts     (20261104092000_data_retention_and_deletion.sql)
// * public.submitted_record_retention()   submitted records (same)
// * public.ops_event_retention()          monitoring events (20261104091000_ops_monitoring.sql)
// * public.email_event_retention()        email delivery    (20261104092000_data_retention_and_deletion.sql)
// * public.ai_event_retention()           AI call records   (20261103120200_ai_extraction_events.sql)
//
// src/data/schemaSync.test.ts keeps those equal to RETENTION, and dataPolicy.test.ts checks that every table
// and storage bucket the migrations create belongs to a data class below, so nothing new is stored unclassified.
//
// DRAFT (decision D4): the windows are recommended defaults. LEGAL confirms them before launch.

import { BACKUP_MAX_AGE_MS } from "./intakeBackup";
import { DRAFT_RETENTION_DAYS } from "./intakeLifecycle";

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
      "Personal information about the prospect's employees: who they are, their dates of birth, pay, benefits, dependents and injuries, and anything that holds it (uploaded files, the conversation, the Manuscript).",
    handling: [
      "Only the prospect who provided it and Edgar Allan Advisory's advisors can open it, and the database enforces that.",
      "Never put it in email, chat, tickets, alerts, logs, analytics or a link. Notifications carry named contact fields only.",
      "Stored only in the private database and private storage buckets. Files open through links that expire after 60 seconds.",
      "Dates of birth are masked unless an advisor reveals them for the task at hand, and a Manuscript generated with them revealed is recorded as such.",
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
      "Shared outside Edgar Allan Advisory only by the prospect, or with the prospect's permission.",
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
    meaning: "What the site publishes: marketing copy, the sample Manuscript (invented data) and the sourced PEO catalog.",
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
  /** Operational monitoring events. */
  opsEventDays: 90,
  /** Email delivery events (sent, delivered, bounced, complained). */
  emailEventDays: 365,
  /** AI rate-limit records. */
  aiLimitDays: 1,
  /** The record of each AI call: ids, codes and field names, never values. */
  aiEventDays: 90,
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
    record: "Generated Manuscript PDFs",
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
    stored: { tables: ["chamber_sessions", "chamber_certifications", "documents"], buckets: ["documents"], elsewhere: [] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "payroll",
    label: "Payroll",
    sensitivity: "restricted",
    examples: "Pay frequency, payroll provider, annual payroll and uploaded payroll reports or registers.",
    stored: { tables: ["chamber_sessions", "chamber_certifications", "documents"], buckets: ["documents"], elsewhere: [] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "benefits",
    label: "Benefits",
    sensitivity: "restricted",
    examples: "Current plans and carriers, contributions, renewal dates, benefits summaries and invoices (which can list employees and premiums).",
    stored: { tables: ["chamber_sessions", "chamber_certifications", "documents"], buckets: ["documents"], elsewhere: [] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "workers_comp",
    label: "Workers' compensation records",
    sensitivity: "restricted",
    examples: "Class codes, experience modifier, loss runs and claims history, which can describe injuries to named employees.",
    stored: { tables: ["chamber_sessions", "chamber_certifications", "documents"], buckets: ["documents"], elsewhere: [] },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "documents",
    label: "Uploaded documents",
    sensitivity: "restricted",
    examples: "Every file uploaded to an intake, whatever its category, and the values read out of it for review.",
    stored: { tables: ["documents"], buckets: ["documents"], elsewhere: ["The AI provider, for the moment a file is read (D11)"] },
    retention: `${WITH_INTAKE} The prospect can remove a document while the intake is open.`,
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
      elsewhere: ["The AI provider, for each message Lenore reads (D11)", "ElevenLabs, for voice conversations (opt-in beta)"],
    },
    retention: WITH_INTAKE,
    deletion: DELETED_WITH_INTAKE,
  },
  {
    id: "manuscripts",
    label: "Generated Manuscript PDFs",
    sensitivity: "restricted",
    examples: "The underwriting packet, which carries the census. The prospect's own download is made in their browser and never stored by us.",
    stored: { tables: ["manuscript_versions"], buckets: ["manuscripts"], elsewhere: ["The prospect's own device (their download)"] },
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
    examples: "Advisors' field reviews and corrections, internal notes, pipeline status and its history.",
    stored: {
      tables: ["advisor_field_reviews", "advisor_review_events", "advisor_notes", "submission_workflow", "submission_status_history"],
      buckets: [],
      elsewhere: [],
    },
    retention: WITH_INTAKE,
    deletion: `${DELETED_WITH_INTAKE} The append-only history can only be removed by that process.`,
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
    examples: "Sign-in accounts (including guest accounts), profiles and advisor or admin roles.",
    stored: { tables: ["profiles", "user_roles"], buckets: [], elsewhere: ["Supabase Auth (email, password hash, sign-in history)"] },
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
    examples: "Failure counts and codes (errors, failed uploads, AI failures, refused access), the alerts raised from them, a record of each AI call (ids, codes and the names of the fields it read, never their values), and the counters that rate-limit AI use (a one-way hash of the network address, never the address).",
    stored: {
      tables: ["ops_events", "ops_alerts", "ai_extraction_events", "ai_request_log", "ai_ip_log", "ai_global_usage"],
      buckets: [],
      elsewhere: ["Supabase and Vercel logs"],
    },
    retention: `Events, AI call records and daily AI totals ${RETENTION.opsEventDays} days; rate-limit records ${RETENTION.aiLimitDays} day; alerts (kind, count and codes only) kept for incident review.`,
    deletion: "By the daily retention jobs. AI call records that point at an intake are also deleted with it.",
  },
];

/** The classes a table or bucket belongs to. */
export function classesStoredIn(where: { table?: string; bucket?: string }): DataClass[] {
  return DATA_CLASSES.filter(
    (c) => (where.table !== undefined && c.stored.tables.includes(where.table)) || (where.bucket !== undefined && c.stored.buckets.includes(where.bucket)),
  );
}
