// The legal pages' metadata (US-6.2): versions, dates, whether counsel has approved the copy, the contact for
// privacy requests and the service providers that handle intake data. The Privacy Policy (/privacy) and
// Terms of Use (/terms) read it; docs/LEGAL_REVIEW.md is the review counsel completes before launch.
//
// DRAFT: NOT LEGALLY REVIEWED (decision D10). Every page that shows this copy says so until
// LEGAL_COPY_APPROVED is true and LEGAL_APPROVAL names who approved which version, and when.

export const PRIVACY_POLICY_VERSION = "2026-11-draft-1";
export const TERMS_VERSION = "2026-11-draft-1";

/** When this wording was last changed, as shown on the pages (YYYY-MM-DD). */
export const LEGAL_LAST_UPDATED = "2026-11-04";

export interface LegalApproval {
  /** Who approved the copy for publication (counsel, by name and firm). */
  approvedBy: string | null;
  /** YYYY-MM-DD. */
  approvedOn: string | null;
  /** The privacy policy and terms versions approved. Must equal the versions above. */
  version: string | null;
}

/** Set by LEGAL's approval (docs/LEGAL_REVIEW.md, "Making approval live"). Until then the pages say they are drafts. */
export const LEGAL_COPY_APPROVED = false;
export const LEGAL_APPROVAL: LegalApproval = { approvedBy: null, approvedOn: null, version: null };

/** Marks a section of the Terms of Use that only counsel can write (docs/LEGAL_REVIEW.md lists each one). */
export const COUNSEL_PLACEHOLDER = "[To be completed by counsel.]";

/**
 * Where a prospect sends privacy and deletion requests. Not decided yet: a placeholder until the business
 * names a monitored address (docs/LEGAL_REVIEW.md). Never put a personal address here.
 */
export const PRIVACY_CONTACT: string | null = null;

/** What the pages say while PRIVACY_CONTACT is unset. */
export const PRIVACY_CONTACT_PENDING =
  "The address for privacy and deletion requests will be published here before launch. Until then, ask the advisor you're working with.";

export interface ServiceProvider {
  name: string;
  /** What it does for the product, in the prospect's words. */
  role: string;
  /** What of the prospect's information it handles. */
  handles: string;
}

/**
 * The services that handle intake information for us. Keep this in step with the code: a new provider, or a
 * provider handling more than listed, means updating this list and the review.
 */
export const SERVICE_PROVIDERS: ServiceProvider[] = [
  {
    name: "Supabase",
    role: "Database, private file storage and sign-in",
    handles: "Everything stored for an intake: answers, conversation, uploaded documents, certifications and accounts.",
  },
  {
    name: "Vercel",
    role: "Hosting for this website",
    handles: "The pages you load and the network details any web host sees, such as your IP address. Intake answers are not stored there.",
  },
  {
    name: "Resend",
    role: "Email delivery",
    handles: "Sign-in codes and notification emails: the recipient's address, company name, reference and the contact details in the advisor alert.",
  },
  {
    name: "An AI model provider",
    role: "Lenore's replies and reading uploaded documents",
    handles: "Each message you send Lenore with the answers captured so far, and the text of documents you ask it to read. The provider has not been chosen yet; it will be named here before launch.",
  },
  {
    name: "ElevenLabs",
    role: "Voice conversations with Lenore (an optional beta)",
    handles: "What you say and hear when you choose to talk rather than type. Not used if you type.",
  },
  {
    name: "Cloudflare Turnstile",
    role: "A check that a new guest session is a person, when it is switched on",
    handles: "Browser signals Cloudflare uses to tell people from bots. No intake answers.",
  },
];
