// The leads' bulk actions as the bar names them, in the story's order (CRM-L1.1, D-811): change owner, change status (New or Working), Not a fit (one reason
// for all), set a field, add or remove a label, delete (to the bin). Export is the shared export, after them.

export const LEAD_BULK_KINDS = ["owner", "status", "not_fit", "field", "label", "delete"] as const;
export type LeadBulkKind = (typeof LEAD_BULK_KINDS)[number];

export const LEAD_BULK_TITLES: Record<LeadBulkKind, string> = {
  owner: "Change owner",
  status: "Change status",
  not_fit: "Not a fit",
  field: "Set a field",
  label: "Label",
  delete: "Delete",
};

/** "1 lead", "42 leads". */
export const leadsWords = (n: number): string => `${n.toLocaleString("en-US")} ${n === 1 ? "lead" : "leads"}`;
