import type { MyFirm } from "@/lib/advisorApi";

/** Why a person has no current firm: they belong to none, to this address's firm not at all, or to several. */
export type Refusal = "none" | "not_this_firm" | "several";

/**
 * The one firm the console acts for, from the person's own memberships and the address they are at (story P-1.4). At a
 * firm's address the current firm is that address's firm: it must be one of theirs, and the person's role is the one they hold
 * there. `several` says the person belongs to other firms too. The database narrows each answer to the firms the person
 * belongs to and no further (D-18), so a page that does not itself act for the address's firm cannot tell which is meant:
 * a member route must refuse `several` (the guard does), and only a page that checks the address's firm (the owner-only
 * Activity page) may accept it. On the bare domain there is no address to choose by, so a member of several firms has no
 * current firm; a member of exactly one has that firm. Every guard, link and page that asks "is this person a member / an
 * owner here" asks this and nothing else.
 */
export function currentFirm(
  firms: MyFirm[],
  address: string | null,
): { firm: MyFirm; several: boolean } | { refusal: Refusal } {
  if (firms.length === 0) return { refusal: "none" };
  if (address !== null) {
    const here = firms.find((f) => f.address === address);
    return here ? { firm: here, several: firms.length > 1 } : { refusal: "not_this_firm" };
  }
  if (firms.length > 1) return { refusal: "several" };
  return { firm: firms[0], several: false };
}
