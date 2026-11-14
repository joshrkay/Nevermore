import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { useMyFirms, useMySupportSession } from "@/hooks/useOwnedFirms";
import { fetchIsAdmin, type MyFirm } from "@/lib/advisorApi";
import { currentFirm } from "@/lib/currentFirm";

export type FirmRoleLabel = "Owner" | "Lead" | "Agent" | "Nevermore support";
const ROLE_LABELS: Record<string, FirmRoleLabel> = { owner: "Owner", lead: "Lead", agent: "Agent", support: "Nevermore support" };

export interface Workspace {
  /** The firm the page is showing, or null until known (or when the person has none to show). */
  firm: { id: string; name: string; address: string } | null;
  role: FirmRoleLabel | null;
  isOwner: boolean;
  /** Whether the person is a platform admin looking at the firm on a support session (story CRM-P2.4): they can read and nothing else. */
  isSupport: boolean;
  /** When the support session ends, for the banner; null when the person is not on one. */
  supportEndsAt: string | null;
  /** The support session's id, for "End now"; null when the person is not on one. */
  supportSessionId: string | null;
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

const WorkspaceContext = createContext<Workspace | null>(null);

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
