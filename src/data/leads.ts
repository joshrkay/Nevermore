import type { LEAD_NOT_FIT_REASONS, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/leadsApi";

// The words a lead's codes read as on screens (stories CRM-L1.x; GLOSSARY.md "Lead"). One list, for the table, the lead's page and its forms.

export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUSES)[number], string> = {
  new: "New",
  working: "Working",
  converted: "Converted",
  not_fit: "Not a fit",
};

export const LEAD_SOURCE_LABELS: Record<(typeof LEAD_SOURCES)[number], string> = {
  added_by_hand: "Added by hand",
  import: "Import",
  referral_partner: "Referral partner",
  firms_link: "Firm's link",
};

export const LEAD_NOT_FIT_REASON_LABELS: Record<(typeof LEAD_NOT_FIT_REASONS)[number], string> = {
  too_small: "Too small",
  wrong_industry: "Wrong industry",
  not_interested: "Not interested",
  bad_contact_details: "Bad contact details",
  other: "Other",
};

/** What the Leads page says (story CRM-L1.1a and its states). */
export const leadsTableWords = {
  nothingYet: "Leads are people you aren't quoting yet",
} as const;
