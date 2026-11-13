import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { fetchIsAdvisor } from "@/lib/advisorApi";
import { useAuth } from "@/hooks/useAuth";
import RequireAccess, { AccessMessage } from "./RequireAccess";

// Advisor pages need a signed-in (not guest) account that holds the advisor or admin role.
// This only decides what to render: the database refuses advisor data to everyone else anyway.
const RequireAdvisor = ({ children }: { children: ReactNode }) => {
  const { signOut } = useAuth();
  return (
    <RequireAccess
      check={fetchIsAdvisor}
      deniedCode="advisor_route"
      denied={(email) => (
        <AccessMessage title="Waiting for access">
          <p className="text-muted-foreground mb-4">
            Your account{email ? ` (${email})` : ""} is created. An administrator has to give you access before you can see
            submissions, and nothing is shared with you until then. If you should have access already, ask an administrator to grant it.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/" className="text-primary underline hover:text-primary/90">Home</Link>
            <button onClick={() => void signOut()} className="text-primary underline hover:text-primary/90">
              Sign in with another account
            </button>
          </div>
        </AccessMessage>
      )}
    >
      {children}
    </RequireAccess>
  );
};

export default RequireAdvisor;
