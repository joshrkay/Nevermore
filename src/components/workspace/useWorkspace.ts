import { createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { useMyFirms, useMySupportSession } from "@/hooks/useOwnedFirms";
import { fetchIsAdmin, type MyFirm } from "@/lib/advisorApi";
import { currentFirm } from "@/lib/currentFirm";
import { WorkspaceContext, type FirmRoleLabel, type Workspace } from "./workspaceContext";

export { WorkspaceContext, type FirmRoleLabel, type Workspace };

const ROLE_LABELS: Record<string, FirmRoleLabel> = { owner: "Owner", lead: "Lead", agent: "Agent", support: "Nevermore support" };

/** The firm a person works in: the console's current firm (currentFirm, the one rule), or none. */
function firmShown(firms: MyFirm[] | null, address: string | null): MyFirm | null {
  if (!firms) return null;
  const here = currentFirm(firms, address);
  return "firm" in here ? here.firm : null;
}

/** Asks the database once; read through `WorkspaceProvider`, never called by the parts of the shell themselves. */
function useLoadWorkspace(): Workspace {
  const { user } = useAuth();
  const firmAddress = useFirmAddress();
  const mine = useMyFirms();
  const supportSession = useMySupportSession();
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
    isSupport: shown?.role === "support",
    supportEndsAt: shown?.role === "support" && supportSession?.isOpen ? supportSession.endsAt : null,
    supportSessionId: shown?.role === "support" && supportSession?.isOpen ? supportSession.id : null,
    isPlatformAdmin,
    person: named?.trim() ?? user?.email ?? "",
  };
}

/** Loads the workspace state once for everything inside the shell (one platform-admin question, not one per reader). */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  return createElement(WorkspaceContext.Provider, { value: useLoadWorkspace() }, children);
}

/** Which firm and role the workspace is showing, who the person is, and whether they are a platform admin. */
export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace must be used inside the workspace shell.");
  return workspace;
}
