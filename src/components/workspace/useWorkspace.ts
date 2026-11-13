import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { useMyFirms } from "@/hooks/useOwnedFirms";
import { fetchIsAdmin, type MyFirm } from "@/lib/advisorApi";
import { currentFirm } from "@/lib/currentFirm";

export type FirmRoleLabel = "Owner" | "Lead" | "Agent";
const ROLE_LABELS: Record<string, FirmRoleLabel> = { owner: "Owner", lead: "Lead", agent: "Agent" };

export interface Workspace {
  /** The firm the page is showing, or null until known (or when the person has none to show). */
  firm: { id: string; name: string; address: string } | null;
  role: FirmRoleLabel | null;
  isOwner: boolean;
  /** Whether the database says the person is a platform admin; false until known or when it can't be asked (D-37). */
  isPlatformAdmin: boolean;
  /** The person's name, or their email when they have no name (D-42). */
  person: string;
}

/** The firm a person works in: the console's current firm (currentFirm, the one rule), or none. */
function firmShown(firms: MyFirm[] | null, address: string | null): MyFirm | null {
  if (!firms) return null;
  const here = currentFirm(firms, address);
  return "firm" in here ? here.firm : null;
}

/** Which firm and role the workspace is showing, who the person is, and whether they are a platform admin. */
export function useWorkspace(): Workspace {
  const { user } = useAuth();
  const firmAddress = useFirmAddress();
  const mine = useMyFirms();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => fetchIsAdmin())().then((admin) => !cancelled && setIsPlatformAdmin(admin), () => !cancelled && setIsPlatformAdmin(false));
    return () => { cancelled = true; };
  }, [user?.id]);

  const shown = firmShown(mine, firmAddress.status === "known" ? firmAddress.address : null);
  const meta = (user?.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const named = [meta.full_name, meta.name].find((n): n is string => typeof n === "string" && n.trim() !== "");
  return {
    firm: shown ? { id: shown.firm_id, name: shown.name, address: shown.address } : null,
    role: shown ? ROLE_LABELS[shown.role] ?? null : null,
    isOwner: shown?.role === "owner",
    isPlatformAdmin,
    person: named?.trim() ?? user?.email ?? "",
  };
}
