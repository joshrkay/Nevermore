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
    retention: `${WITH_INTAKE} Account details until the account is deleted. A queued email about an intake goes with the intake; the one email that belongs to a firm instead (see Email notifications) is kept ${RETENTION.firmActivityDays} days.`,
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
    examples: "Who certified an intake, their role, when, the exact wording they agreed to and a fingerprint and a copy of the answers as signed; each agreement to how intake information is used; and each PEO the employer authorized to receive their packet or withdrew, with the wording, its version, who signed and when.",
    stored: { tables: ["chamber_certifications", "intake_consents", "peo_authorizations"], buckets: [], elsewhere: [] },
    retention: `Certifications and PEO authorizations are kept with the submitted record; a PEO authorization is never changed, only added to. Consent records are kept until the account is deleted.`,
    deletion: `Certifications and PEO authorizations: ${DELETED_WITH_INTAKE.toLowerCase()} Consent records go with the account.`,
  },
  {
    id: "advisor_work",
    label: "Advisor review and notes",
    sensitivity: "confidential",
    examples: "Advisors' field reviews and corrections, internal notes, pipeline status and its history, the requests for information sent to the prospect, the PEOs each submission went to with what each quoted (the whole offer: its fee and basis, one-off fees, workers' comp, unemployment tax and medical rates, marked an estimate or a firm offer) and every change to that, and who changed each uploaded document and when.",
    stored: {
      tables: ["advisor_field_reviews", "advisor_review_events", "advisor_notes", "submission_workflow", "submission_status_history", "information_requests", "quote_requests", "quotes", "quote_request_events", "quote_request_notes", "quote_request_addresses", "quote_request_thread_reads", "document_events"],
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
    examples: "Mail a PEO sent to a quote request's reply address, and the advisor's own messages copied to it: who wrote it, when, the plain text, a few headers, and its attachments (a proposal can carry an employer's details and a PEO's pricing). Mail to an address that matched nothing is held until an admin deals with it. For a reply, what the AI suggested it means (one of four words) and whether the agent accepted or dismissed it, with who and when: never the reply's words. A quote document is read on request: the figures it proposes are shown to the agent and kept only when the agent records the quote.",
    stored: { tables: ["quote_request_messages", "quote_request_message_attachments"], buckets: ["peo-mail"], elsewhere: ["Resend", "The AI provider, for the text of each reply it is asked to read (N-1.1) and of a quote document the agent asks it to read (N-2.3, text only, sensitive numbers removed, nothing kept there by us)"] },
    retention: `${WITH_INTAKE} Held mail nobody assigns is deleted ${RETENTION.heldMailDays} days after it was held (story M-3.3), files first. Resend keeps what it received too, under its own terms, until it is deleted there.`,
    deletion: `${DELETED_WITH_INTAKE} An attachment is stored only once it has been scanned for malware; one the scanner flags is never stored, only its signature.`,
  },
  {
    id: "bundle_links",
    label: "Bundle links sent to PEOs",
    sensitivity: "restricted",
    examples: "The link a PEO opens to download one certified version of a submission's bundle (ADR 0003): which quote request and version it is for, the files it lists (copies of the packet, the census file, the application data, the supplement and the answers as JSON; the uploaded documents are named, not copied), the open items when it was issued, when it stops working and why it was revoked. The link's token is never kept, only a hash of it. Each download is on the quote request's timeline.",
    stored: { tables: ["bundle_links"], buckets: ["bundle-links"], elsewhere: [] },
    retention: `${WITH_INTAKE} A link stops working 30 days after it is issued, or when it is revoked; its row and files stay with the intake.`,
    deletion: `${DELETED_WITH_INTAKE} Kept when a firm closes, as its intakes are.`,
  },
  {
    id: "peo_registrations",
    label: "Registrations with PEOs",
    sensitivity: "restricted",
    examples: "Each time a firm sends an employer's packet to a PEO: which firm, which PEO, the employer's FEIN (or its name and state when it gave none), the File ID, the version and when. It is the firm's proof of when it submitted the employer. Another firm sending the same employer to the same PEO is told that one exists and when, never which firm.",
    stored: { tables: ["peo_registrations"], buckets: [], elsewhere: [] },
    retention: "Kept: a registration is evidence of a send that happened. It stays when the intake is deleted and when the firm closes (D-1634, D-1635).",
    deletion: "Never changed or deleted, by anyone, a platform admin included: the table refuses it. Read only through the firm's own statement (the FEIN by its last four digits) and the warning, which names no firm.",
    awaitingCounsel: "How long a registration is kept once its intake is deleted or its firm has closed, and what an employer who asks for deletion is told about it, is counsel's to set (QP-D4).",
  },
  {
    id: "intake_access_ends",
    label: "Firm access ended by the employer",
    sensitivity: "internal",
    examples: "Each time an employer ended a firm's access to their intake (CRM-P2.5): which firm (its name as it was), which intake and opportunity, which employer and when. It holds no answers.",
    stored: { tables: ["intake_access_ends"], buckets: [], elsewhere: [] },
    retention: "Kept: it is the firm's record of why an opportunity lost its intake. It stays when the intake is deleted and when the firm closes.",
    deletion: "Never changed or deleted by anyone: the table refuses it. Closed to the API; the firm reads the note the ending leaves on the opportunity.",
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
    retention: `Queued emails about an intake are kept with their intake. The email that tells a firm's owners a member left belongs to the firm, not to an intake, and is kept ${RETENTION.firmActivityDays} days after it was queued, like the firm's record. Delivery events ${RETENTION.emailEventDays} days. Suppressions until removed on request.`,
    deletion: "Queued emails about an intake are deleted with their intake; the firm-level email by the daily job that prunes the firm's record (prune_firm_outbox_events); delivery events by the daily retention job; suppressions by hand.",
  },
  {
    id: "account",
    label: "Accounts and access",
    sensitivity: "confidential",
    examples: "Sign-in accounts (including guest accounts), profiles and advisor or admin roles, the retired platform list of organisations whose members got the advisor role without an admin, and the log of who was granted it and why.",
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
    examples: "Failure counts and codes (errors, failed uploads, AI failures, refused access), the alerts raised from them, a record of each AI call (ids, codes and the names of the fields it read, never their values), the counters that rate-limit AI use and guesses at a bundle link (a one-way hash of the network address, never the address), and the per-year counter that numbers File IDs.",
    stored: {
      tables: ["ops_events", "ops_alerts", "ai_extraction_events", "ai_request_log", "ai_ip_log", "ai_global_usage", "submission_reference_counters", "bundle_link_misses"],
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
    stored: { tables: ["firms", "firm_teams", "firm_memberships", "firm_member_suspensions", "firm_suspensions", "firm_closures", "support_sessions"], buckets: [], elsewhere: [] },
    retention: "For good: a membership is never changed, only ended, so who could see a record on a given day can always be answered.",
    deletion: "A member's account deleted at their request removes their memberships; a firm's last current owner can't be removed. A closed firm's own working data (invitations, listed organisations, requests to join, saved views, column choices, referral partners and teams) is deleted 30 days after an owner asked; every membership is ended, not deleted, and the platform keeps a record of the closing with a count per table and no content (CRM-P1.7). Intakes are never deleted by it (docs/DATA_HANDLING.md). The platform keeps its own record of each hour of support access Nevermore opened on a firm (which firm, why, when it started and ended, and which Nevermore person, for the platform alone, CRM-P2.4); the firm's owners read the reason and the times and never who, and the record is kept after the firm closes.",
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
    id: "intake_invitations",
    label: "Invitations to finish and certify an intake",
    sensitivity: "confidential",
    examples: "The email address and name of the client a firm invited to finish an intake it started, who invited them, when they were first invited, reminded and last opened the link, when it ends, whether the email went out and when the client accepted. The link's token is never kept, only a hash of it. Nothing about the answers.",
    stored: { tables: ["intake_invitations"], buckets: [], elsewhere: ["Resend, which sends the invitation email (the address and the link, once)"] },
    retention: "Kept with the firm: each link a reminder replaced stays as the record of how often the client was written to. Deleted when the firm closes (the intake stays with its employer). A rule to clear old ones is not built yet (docs/DATA_HANDLING.md).",
    deletion: "A member's account deleted at their request clears who invited from the invitations that name it; the client's email address stays until the firm closes or a later story clears expired invitations (docs/DATA_HANDLING.md).",
  },
  {
    id: "firm_join_by_organisation",
    label: "The organisations a firm lists, and requests to join it",
    sensitivity: "confidential",
    examples: "The Google domains and Microsoft tenants a firm's owners listed (a domain or tenant ID and the name the owner gave it), and each request to join: which account asked, when, which listed organisation vouched, and whether an owner approved it (with the role) or declined it, and who decided. Nothing about an intake.",
    stored: { tables: ["firm_organisations", "join_requests"], buckets: [], elsewhere: [] },
    retention: "Kept with the firm, as the record of how a person joined or was turned away. A declined request is kept so the same person is not listed again each time they sign in. A rule to clear old requests is not built yet (docs/DATA_HANDLING.md).",
    deletion: "A person's account deleted at their request removes their requests; a firm's listing is removed by an owner. A closed firm's own working data (invitations, listed organisations, requests to join, saved views, column choices, referral partners and teams) is deleted 30 days after an owner asked; every membership is ended, not deleted, and the platform keeps a record of the closing with a count per table and no content (CRM-P1.7). Intakes are never deleted by it (docs/DATA_HANDLING.md). The platform keeps its own record of each hour of support access Nevermore opened on a firm (which firm, why, when it started and ended, and which Nevermore person, for the platform alone, CRM-P2.4); the firm's owners read the reason and the times and never who, and the record is kept after the firm closes.",
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
  {
    id: "record_history",
    label: "The history of a record",
    sensitivity: "confidential",
    examples: "For each record a firm keeps (a referral partner, an account, a contact, an opportunity), who created it and when, and every change to its own fields: who, when, the field, and the value before and after (a partner's name or kind, an account's name or owner, a contact's email). Only the fields a trigger was told to track; never an intake's answers.",
    stored: { tables: ["record_history"], buckets: [], elsewhere: [] },
    retention: "Kept as long as the record is (D-45). It starts when it shipped: changes before then were not kept.",
    deletion: "Nobody can change or delete an entry, an admin included. Deleting a record removes its history in the same step, and closing a firm (CRM-P1.7) deletes the firm's histories with its other data. A firm reads it through one function, as a member of the record's firm; who at Nevermore acted reads as \"Nevermore\", with no name, email or id (D-33).",
  },
  {
    id: "imports",
    label: "A firm's imports",
    sensitivity: "internal",
    examples: "Each import an owner or a lead ran: which kind (leads, or accounts with their contacts), the file's name, how many rows, who ran it and when, and whether it was undone. For each row of the file: its number, whether it made a record, was already here or could not be imported, the reason in words, and the id of what it made. No value from the file is kept here: what a row made is the lead, account, contact or renewal itself.",
    stored: { tables: ["imports", "import_rows"], buckets: [], elsewhere: [] },
    retention: "Kept with the firm, as the record of how its book came in. The file itself is read in the browser and never stored.",
    deletion: "An import is undone as a whole for 30 days, which removes what it made and keeps the record that it ran. Closing a firm (CRM-P1.7) deletes both tables' rows with the firm's other data.",
  },
  {
    id: "member_settings",
    label: "A person's settings for the daily summary",
    sensitivity: "internal",
    examples: "Whether a person gets the daily summary, and the time zone their morning is in (first taken from their browser, then theirs to change). One row for a person, whatever firms they belong to. The summary itself is an email that names the records needing them (an account, a lead, a task's title, a PEO), queued in the outbox with the other emails; it never holds an intake's answers, a census or a FEIN.",
    stored: { tables: ["member_settings"], buckets: [], elsewhere: [] },
    retention: "Kept while the person has an account.",
    deletion: "Deleted with the person's account. A person turns the summary off, or changes the time zone, in Settings.",
  },
  {
    id: "firm_markets_and_licences",
    label: "A firm's contacts at PEOs and carriers, its requests for one, and its licences on record",
    sensitivity: "confidential",
    examples: "The people a firm deals with at a listed PEO or carrier (name, role, email, phone, and who added them), seen by no other firm and offered first when that firm sends. A firm's requests for a PEO or carrier that isn't listed (its name, what it quotes, a contact there, a note) and the platform admin's answer. The firm's National Producer Number, each state and line it says it is licensed in (life and health, or property and casualty), the licence number and expiry where given, and when a platform admin last recorded that they checked them. Never an intake's answers.",
    stored: { tables: ["firm_market_contacts", "market_requests", "firm_licences", "firm_licence_records"], buckets: [], elsewhere: [] },
    retention: "Kept by the firm until a member removes the contact or an owner removes the licence. A request is kept with its answer.",
    deletion: "A member of the firm removes a contact; an owner removes a licence or clears the producer number. Closing a firm (CRM-P1.7) deletes all four with the firm's other data. Platform admins read every firm's requests and licences, to keep the list of PEOs and carriers and to approve firms; no other firm reads any of it.",
  },
  {
    id: "firm_message_templates",
    label: "A firm's message templates",
    sensitivity: "confidential",
    examples: "What a firm's messages to a PEO or carrier open with, by kind (a first send, a follow-up, a withdrawal), and who last changed each. The words are the firm's own and may name its people. Every member of the firm reads them when writing a message; no other firm does.",
    stored: { tables: ["firm_message_templates"], buckets: [], elsewhere: [] },
    retention: "Kept until an owner clears one.",
    deletion: "An owner clears a template in Settings, which puts the product's own text back. Closing a firm (CRM-P1.7) deletes them with the firm's other data.",
  },
  {
    id: "crm_records",
    label: "A firm's accounts, contacts, opportunities, calls, notes, tasks, placements and renewals",
    sensitivity: "confidential",
    examples: "The businesses a firm quotes for (name, trade name, website, phone, address, industry, employees, states, current provider, where the record came from), the people at them (name, title, email, phone, mobile, whether they are the main contact or may be emailed) and each search for an account (name, target start, employees, expected close, value, next step), each with its record owner. The calls, notes and tasks logged on an account (who with, about what, when, the outcome and what was said; a note's text and its dated additions; what a task is, for whom and when it is due), each with who logged it. The placements the firm made for an account (the PEO's name, when it started if known, the broker of record, when it ended) and the renewals of an account's cover (what renews, with whom, the date, and the day it was marked as not renewed). The commission a placement expects (its basis, the number and the figure for a year) and each payment of commission the firm received (the day, the amount and a note), seen only by the firm; why an opportunity was lost (the reason and a note). Never a tax ID, a census or anything about an employee (ADR 0006): those stay in the intake. The broker's notes on the comparison of an opportunity's quotes (what they are about, whether internal or for the client, who wrote them).",
    stored: { tables: ["accounts", "contacts", "opportunities", "activities", "labels", "account_labels", "placements", "renewals", "commission_payments", "merged_records", "quote_comparison_notes"], buckets: [], elsewhere: [] },
    retention: "Kept by the firm until it deletes the record. An account that has an opportunity is archived, never deleted; one with none is deleted with its contacts, calls, notes, tasks, placements and renewals; the intake itself stays with its employer under the intake's own rules. Each record's history is kept with it.",
    deletion: "By the firm, when the later stories that delete a record ship (an account's record owner or a firm owner may delete one with no opportunity or email, D-204, D-219). Closing a firm (CRM-P1.7) deletes all of them with the firm's other data. A person who is deleted leaves the records they owned with no owner, for a firm owner to assign.",
  },
  {
    id: "leads",
    label: "A firm's leads",
    sensitivity: "confidential",
    examples: "People and their businesses a firm is not quoting yet (CRM-L1.x): the person's name, title, email and phone; the business's name, state, city, employees and current provider; a note; where the lead came from, its status (New, Working, Converted, Not a fit with its reason) and its record owner; when it was converted and the account, contact and opportunity it made; the calls, notes and tasks logged on it (held with the firm's other calls, notes and tasks) and the labels on it. Never a tax ID, a census or anything about an employee.",
    stored: { tables: ["leads", "lead_labels"], buckets: [], elsewhere: [] },
    retention: "Kept by the firm until it deletes the lead. A deleted lead waits in the bin for 30 days, where a firm owner can restore it, and is then removed with its calls, notes, tasks and labels (D-806). A converted lead can't be deleted. Its history is kept with it.",
    deletion: "By the firm, through the bin (CRM-L1.1). Closing a firm (CRM-P1.7) deletes all of them with its other data. A person who is deleted leaves the leads they owned with no owner, for a firm owner to assign.",
  },
  {
    id: "conversations",
    label: "A firm's mail with its contacts and leads",
    // Restricted since replies are received (CRM-E1.3, D-667): a contact's reply can carry a census or a payroll file.
    sensitivity: "restricted",
    examples: "For each contact and each lead the firm writes to (CRM-E1.2), one conversation and its reply address, and each message on it: who it was from and to (with any CC), its subject and text, its Message-ID and the message it answers, who in the firm wrote it, when, and whether it was queued, sent (with Google's or Microsoft's id) or failed and why. Sent through the writer's own mailbox (ADR 0005); never a file (D-605), and never anything read from a mailbox. Replies to the conversation's address (CRM-E1.3): who sent each (address and name), to and CC, subject, plain text, its Message-ID and the one it answers, whether it is automatic, the firm's own copy, or from someone new, and when anyone in the firm last opened the conversation; each file on a reply, by name, type and size, with what became of it (kept once scanned clean, blocked with the scanner's signature, or not kept and why), and the bytes of a clean one.",
    stored: { tables: ["conversations", "conversation_messages", "conversation_message_attachments"], buckets: ["contact-mail"], elsewhere: ["the writer's own Sent folder, at Google or Microsoft", "Resend, which receives the replies", "The malware scanner, while it checks a received file (docs/adr/0002)"] },
    retention: "Kept as long as the contact or lead it is with: a contact's goes with its account, a lead's with the lead (when it leaves the bin for good, D-806). A copy stays in the writer's own Sent folder, which is theirs, not the product's.",
    deletion: "With the account or the lead it is with, and closing a firm (CRM-P1.7) deletes all of them with its other data. No one edits a message once it is recorded. A person who is deleted leaves the messages they wrote, with no writer named. A received file's row goes with its message; its bytes stay in the contact-mail bucket, unreadable to anyone once the row is gone, until storage is cleaned up (D-667).",
  },
  {
    id: "conversation_files",
    label: "File links on a firm's mail with its contacts",
    sensitivity: "restricted",
    examples: "Each file of an account's own that went with a message to one of its contacts (D-605), as a link, never an attachment: which message and which uploaded document (named, not copied: a census holds employees' personal information), the file's name, when its link was issued and stops working, whether it was revoked, and each time it was downloaded. The link's token is never kept, only a hash of it.",
    stored: { tables: ["conversation_message_files", "conversation_file_downloads"], buckets: [], elsewhere: ["the message in the writer's Sent folder and the contact's inbox, which holds the link until it stops working"] },
    retention: "Kept with the message it went with. A link stops working 30 days after the message was sent; the file itself stays with its intake.",
    deletion: "With the message (its account or contact) and with the document it names (its intake). Closing a firm (CRM-P1.7) deletes them with the firm's other data.",
  },
  {
    id: "recent_records",
    label: "The records a person opened last",
    sensitivity: "internal",
    examples: "For each person in a firm, which account, contact, opportunity or quote they opened last (the kind of record, its number and when), the last 20, so the search box can show the last five opened. Never a name, a field or anything an intake holds: the box reads the record itself, and only while the person may still see it.",
    stored: { tables: ["recent_records"], buckets: [], elsewhere: [] },
    retention: "The last 20 of each person in each firm; opening a record again moves it to the top, and the oldest is dropped. Nevermore support records none.",
    deletion: "Closing a firm (CRM-P1.7) deletes them with its other data. A person's account deleted at their request removes theirs.",
  },
  {
    id: "bulk_changes",
    label: "A bulk change kept for its undo",
    sensitivity: "confidential",
    examples: "What a bulk change to accounts did, kept so the person who made it can undo it: who made it, when, what it was (a new owner, a field and its new value, a label, archiving) and, for each account it changed, the account's name and the value it had before and was changed to.",
    stored: { tables: ["bulk_changes", "bulk_change_records"], buckets: [], elsewhere: [] },
    retention: "Ten minutes of undo (D-202); the rows are cleared by the next bulk change of the firm once they are a day old.",
    deletion: "Cleared as above, and closing a firm (CRM-P1.7) deletes them with the firm's other data. Nobody reads them through the API: only the person who made a change can undo it, through one function.",
  },
  {
    id: "table_settings",
    label: "Column choices and saved views",
    sensitivity: "internal",
    examples: "Which columns a member shows on a table and in what order, and the views a member saved (a name, filters, a sort and columns), with who saved and who shared each. A filter can hold a value a member typed to filter by. Nothing else about an intake.",
    stored: { tables: ["saved_views", "table_preferences"], buckets: [], elsewhere: [] },
    retention: "Kept with the firm until the member changes or deletes them. A member who leaves keeps their rows, read by nobody, and finds them again if they rejoin; a view they shared stays with the firm until an owner unshares it.",
    deletion: "A member's account deleted at their request removes their views and column choices. Closing a firm (CRM-P1.7) deletes its saved views with its other data.",
  },
];

/** The classes a table or bucket belongs to. */
export function classesStoredIn(where: { table?: string; bucket?: string }): DataClass[] {
  return DATA_CLASSES.filter(
    (c) => (where.table !== undefined && c.stored.tables.includes(where.table)) || (where.bucket !== undefined && c.stored.buckets.includes(where.bucket)),
  );
}
