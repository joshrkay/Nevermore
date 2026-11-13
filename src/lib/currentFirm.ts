import type { MyFirm } from "@/lib/advisorApi";

/**
 * Why a person has no current firm: they belong to none, or to this address's firm not at all; or, on the bare domain, they
 * belong to several and choose one first ("Choose a firm", /choose-firm).
 */
export type Refusal = "none" | "not_this_firm" | "several";

/**
 * The one firm the console acts for, from the person's own memberships and the address they are at (stories P-1.4 and
 * CRM-S1.1b). At a firm's address it is that firm, when the person is a current member of it, whatever other firms they belong
 * to: there the database answers for that firm alone (D-40, ADR 0015). On the bare domain the database answers for every firm
 * the person belongs to, so a member of exactly one firm has that firm and a member of several has none until they choose one,
 * at its address. Every guard, link and page that asks "is this person a member / an owner here" asks this and nothing else.
 */
export function currentFirm(firms: MyFirm[], address: string | null): { firm: MyFirm } | { refusal: Refusal } {
  if (firms.length === 0) return { refusal: "none" };
  if (address !== null) {
    const here = firms.find((f) => f.address === address);
    return here ? { firm: here } : { refusal: "not_this_firm" };
  }
  if (firms.length > 1) return { refusal: "several" };
  return { firm: firms[0] };
}

/** Whether the person is an owner of the console's current firm (and not merely of some firm). */
export function isOwnerHere(firms: MyFirm[], address: string | null): boolean {
  const here = currentFirm(firms, address);
  return "firm" in here && here.firm.role === "owner";
}
