// A firm's own opening text for its messages (BR-3.5; 20261203090000_templates_and_reply.sql). Every member reads it; an owner sets it.
import { supabase } from "@/integrations/supabase/client";
import { AdvisorApiError } from "@/lib/advisorApi";
import { TEMPLATE_KINDS, type FirmTemplates, type TemplateKind } from "@/data/messageTemplates";

const read = (data: unknown): FirmTemplates => {
  const d = (data ?? {}) as Record<string, unknown>;
  const out: FirmTemplates = {};
  for (const k of TEMPLATE_KINDS) if (typeof d[k] === "string" && d[k]) out[k] = d[k] as string;
  return out;
};

/** The firm's templates, by kind; a kind with none is absent. With no firm named, the firm the person belongs to. */
export async function loadFirmTemplates(firmId: string | null): Promise<FirmTemplates> {
  const { data, error } = await supabase.rpc("firm_message_templates", { p_firm_id: firmId });
  if (error) throw new AdvisorApiError("Couldn't load your firm's templates. Try again.", error.code);
  return read(data);
}

/** The same, for a composer: with none read, the composer opens with its own text, so a failure is never shown. */
export const firmTemplatesOrNone = (firmId: string | null = null): Promise<FirmTemplates> => loadFirmTemplates(firmId).catch(() => ({}));

/** Sets the firm's text for one kind; nothing puts the product's own back. A refusal the database put into words is shown in them. */
export async function saveFirmTemplate(firmId: string, kind: TemplateKind, body: string): Promise<void> {
  const { error } = await supabase.rpc("set_firm_message_template", { p_firm_id: firmId, p_kind: kind, p_body: body });
  if (error) {
    const inWords = ["22023", "42501", "PT423"].includes(error.code ?? "") && error.message;
    throw new AdvisorApiError(inWords ? error.message : "The template wasn't saved. Try again.", error.code);
  }
}
