import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { loadOwnedFirms } from "@/lib/ownedFirms";
import RequireAccess, { AccessMessage } from "./RequireAccess";

// A page for a firm's owners (the firm's record of who did what). Whether the person owns a firm is the database's
// answer, from their current membership: it doesn't depend on a platform role, so it stays right however "advisor" comes
// to be defined. A password sign-in still owes the second factor first. The page asks the database again for what it reads.
const RequireFirmOwner = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return (
  <RequireAccess
    check={async () => (await loadOwnedFirms(userId)).length > 0}
    deniedCode="firm_owner_route"
    denied={() => (
      <AccessMessage title="For a firm's owners">
        <p className="text-muted-foreground mb-4">Only a firm's owners can read its record of who did what.</p>
        <Link to="/advisor" className="text-primary underline hover:text-primary/90">Back to the console</Link>
      </AccessMessage>
    )}
  >
    {children}
  </RequireAccess>
  );
};

export default RequireFirmOwner;
