import { Link } from "react-router-dom";
import { useRef, type ReactNode } from "react";
import { fetchIsAdmin, type MyFirm } from "@/lib/advisorApi";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { loadMyFirms } from "@/hooks/useOwnedFirms";
import { currentFirm, type Refusal } from "@/lib/currentFirm";
import RequireAccess, { AccessMessage } from "./RequireAccess";

// The guards of the console (story P-1.4). Each asks the database a question about the person's firms or their platform role
// and only decides what to render: the database refuses the data to everyone else anyway (D-18). A password sign-in still owes
// its second factor first (D-19), for a member with no platform role as for one with it.

const SignOutLinks = () => {
  const { signOut } = useAuth();
  return (
    <div className="flex gap-4 justify-center">
      <Link to="/" className="text-primary underline hover:text-primary/90">Home</Link>
      <button onClick={() => void signOut()} className="text-primary underline hover:text-primary/90">
        Sign in with another account
      </button>
    </div>
  );
};

const SeveralFirms = ({ firms, email }: { firms: MyFirm[]; email?: string | null }) => (
  <AccessMessage title="You're a member of more than one firm">
    <p className="text-muted-foreground mb-4">
      Your account{email ? ` (${email})` : ""} belongs to {firms.map((f) => f.name).join(" and ")}. The console shows one firm's
      records at a time and can't yet keep two firms' records apart, so it stays closed to you until it can.
    </p>
    <SignOutLinks />
  </AccessMessage>
);

/**
 * A page of the firm's console. By default the person must be a current member of the firm, at a firm's address that
 * address's firm; `as="owner"` asks for a firm's owner, and `ownersOnly` finishes the sentence "Only a firm's owners can …" that
 * tells anyone else what the page is for (the firm's record of who did what, its members). Whether they hold a platform role
 * is never asked.
 */
const RequireFirm = ({ children, as = "member", ownersOnly = "read its record of who did what" }: { children: ReactNode; as?: "member" | "owner"; ownersOnly?: string }) => {
  const { user, session } = useAuth();
  const firmAddress = useFirmAddress();
  const address = firmAddress.status === "known" ? firmAddress.address : null;
  const userId = user?.id ?? "";
  const sessionKey = session?.access_token ?? "";
  // What the check last learned, so the refusal can say which of the reasons it was.
  const seen = useRef<{ firms: MyFirm[]; refusal: Refusal | null }>({ firms: [], refusal: "none" });

  if (as === "owner") {
    return (
      <RequireAccess
        check={async () => {
          const firms = await loadMyFirms(userId, sessionKey);
          const here = currentFirm(firms, address);
          seen.current = { firms, refusal: "firm" in here ? null : here.refusal };
          return "firm" in here && here.firm.role === "owner";
        }}
        deniedCode="firm_owner_route"
        denied={(email) => {
          const { firms, refusal: why } = seen.current;
          if (why === "several") return <SeveralFirms firms={firms} email={email} />;
          return (
            <AccessMessage title="For a firm's owners">
              <p className="text-muted-foreground mb-4">Only a firm's owners can {ownersOnly}.</p>
              <Link to="/advisor" className="text-primary underline hover:text-primary/90">Back to the console</Link>
            </AccessMessage>
          );
        }}
      >
        {children}
      </RequireAccess>
    );
  }

  return (
    <RequireAccess
      check={async () => {
        const firms = await loadMyFirms(userId, sessionKey);
        const here = currentFirm(firms, address);
        seen.current = { firms, refusal: "firm" in here ? null : here.refusal };
        return seen.current.refusal === null;
      }}
      deniedCode="firm_member_route"
      denied={(email) => {
        const { firms, refusal: why } = seen.current;
        if (why === "several") return <SeveralFirms firms={firms} email={email} />;
        if (why === "not_this_firm") {
          return (
            <AccessMessage title="You aren't a member of this firm">
              <SignOutLinks />
            </AccessMessage>
          );
        }
        return (
          <AccessMessage title="You aren't a member of any firm">
            <p className="text-muted-foreground mb-4">
              Your account{email ? ` (${email})` : ""} isn't a member of a firm, so there is nothing here for you to see. If you should
              be, ask a firm's owner to invite you.
            </p>
            <SignOutLinks />
          </AccessMessage>
        );
      }}
    >
      {children}
    </RequireAccess>
  );
};

/**
 * A page that is platform-wide (the firms waiting for approval, who gets in by organisation, held mail), for the platform's
 * admins. An admin is no member of any firm (D-16), so this is never a way into a firm's console, and the console is never a
 * way into this.
 */
export const RequirePlatformAdmin = ({ children }: { children: ReactNode }) => (
  <RequireAccess
    check={fetchIsAdmin}
    deniedCode="platform_admin_route"
    denied={() => (
      <AccessMessage title="For Nevermore's platform admins">
        <p className="text-muted-foreground mb-4">This page is for the people who run Nevermore, not for a firm.</p>
        <Link to="/advisor" className="text-primary underline hover:text-primary/90">Back to the console</Link>
      </AccessMessage>
    )}
  >
    {children}
  </RequireAccess>
);

export default RequireFirm;
