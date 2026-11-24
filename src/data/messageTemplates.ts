// A firm's own opening text for its messages to a PEO or carrier (docs/BROKER_READINESS_PRD.md BR-3.5; P-3.2; 20261203090000_templates_and_reply.sql).
// A kind with none of the firm's own opens with the text kept in code (src/data/peoFollowUp.ts). The agent edits either before sending; the block the
// product adds under a message is never part of a template.

// sync:begin message_template_kinds
export const TEMPLATE_KINDS = ["send", "follow_up", "withdrawal"] as const;
// sync:end message_template_kinds
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
export type FirmTemplates = Partial<Record<TemplateKind, string>>;

export const TEMPLATE_MAX = 5000;

export const TEMPLATE_WORDS: Record<TemplateKind, { label: string; help: string }> = {
  send: { label: "First send", help: "What your note opens with when you send a submission. Without one, the note starts empty." },
  follow_up: { label: "Follow-up", help: "What a follow-up on a thread opens with." },
  withdrawal: { label: "Withdrawal", help: "What a withdrawal opens with. Give no reason in it: the reason is for your firm only." },
};

/** What a template may name; each is filled in when the message is opened, and the agent can still change the words. */
export const TEMPLATE_FIELDS = [
  { name: "company", means: "the employer's name" },
  { name: "file_id", means: "the File ID" },
  { name: "version", means: "the version sent" },
  { name: "sent_on", means: "the day it was sent" },
  { name: "market", means: "the PEO or carrier (left out when one note goes to several)" },
] as const;
export type TemplateField = (typeof TEMPLATE_FIELDS)[number]["name"];

/** The template with each {field} it names filled in. A field with nothing to say is left out; braces around any other word stay as typed. */
export function fillTemplate(body: string, values: Partial<Record<TemplateField, string | number | null>>): string {
  const known = new Set<string>(TEMPLATE_FIELDS.map((f) => f.name));
  return body.replace(/\{(\w+)\}/g, (whole, name: string) => (known.has(name) ? String(values[name as TemplateField] ?? "") : whole));
}
