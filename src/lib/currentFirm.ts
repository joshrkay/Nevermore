import type { MyFirm } from "@/lib/advisorApi";

/** Why a person has no current firm: they belong to none, to this address's firm not at all, or to several. */
export type Refusal = "none" | "not_this_firm" | "several";

/**
 * The one firm the console acts for, from the person's own memberships and the address they are at (story P-1.4). The
 * console shows one firm's records, and the database narrows each answer to the firms the person belongs to and no further
 * (D-18), so a person in two firms would see both firms' records at once: they have no current firm until the console can
 * tell the two apart. At a firm's address the firm must be one of theirs; on the bare domain a member of exactly one firm
 * has that firm. Every guard, link and page that asks "is this person a member / an owner here" asks this and nothing else.
 */
export function currentFirm(firms: MyFirm[], address: string | null): { firm: MyFirm } | { refusal: Refusal } {
  if (firms.length === 0) return { refusal: "none" };
  if (address !== null && !firms.some((f) => f.address === address)) return { refusal: "not_this_firm" };
  if (firms.length > 1) return { refusal: "several" };
  return { firm: firms[0] };
}

/** Whether the person is an owner of the console's current firm (and not merely of some firm). */
export function isOwnerHere(firms: MyFirm[], address: string | null): boolean {
  const here = currentFirm(firms, address);
  return "firm" in here && here.firm.role === "owner";
}
