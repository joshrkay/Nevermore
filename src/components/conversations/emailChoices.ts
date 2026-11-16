import type { ContactChoice } from "@/components/conversations/EmailAContact";
import { contactName } from "@/data/accountPage";
import { listAccountTab } from "@/lib/accountPageApi";

/** The account's contacts Email offers, as many as one list holds (100): the account's page and its opportunities' pages offer the same. */
export async function emailChoices(firmId: string, accountId: string): Promise<ContactChoice[]> {
  const list = await listAccountTab(firmId, accountId, "contacts", { limit: 100, offset: 0 });
  return (list?.rows ?? []).map((c) => ({ id: c.id, name: contactName(c), email: c.email, doNotEmail: c.doNotEmail, isMain: c.isMain }));
}
