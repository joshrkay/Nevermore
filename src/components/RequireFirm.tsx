import { Link } from "react-router-dom";
import { useRef, type ReactNode } from "react";
import { fetchIsAdmin, type MyFirm } from "@/lib/advisorApi";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { loadMyFirms, loadOwnedFirms } from "@/hooks/useOwnedFirms";
import RequireAccess, { AccessMessage } from "./RequireAccess";

// The guards of the console (story P-1.4). Each asks the database a question about the person's firms or their platform role
// and only decides what to render: the database refuses the data to everyone else anyway (D-18). A password sign-in still owes
// its second factor first (D-19), for a member with no platform role as for one with it.

/** Why a member can't open the console: they belong to no firm, to this address's firm not at all, or to several. */
type Refusal = "none" | "not_this_firm" | "several";

/**
 * Whether the firms a person belongs to let them into the console at this address. The console shows one firm's records,
 * and the database narrows each answer to the firms the person belongs to and no further (D-18), so a person in two firms
 * would see both firms' records at once: they are kept out until the console can tell the two apart. At a firm's address
 * the firm must be one of theirs; on the bare domain a member of exactly one firm lands in it.
 */
function refusal(firms: MyFirm[], address: string | null): Refusal | null {
  if (firms.length === 0) return "none";
  if (address !== null && !firms.some((f) => f.address === address)) return "not_this_firm";
  if (firms.length > 1) return "several";
  return null;
}

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

/**
 * A page of the firm's console. By default the person must be a current member of the firm, at a firm's address that
 * address's firm; `as="owner"` asks for a firm's owner (the firm's record of who did what). Whether they hold a platform role
 * is never asked.
 */
const RequireFirm = ({ children, as = "member" }: { children: ReactNode; as?: "member" | "owner" }) => {
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
        check={async () => (await loadOwnedFirms(userId, sessionKey)).length > 0}
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
  }

  return (
    <RequireAccess
      check={async () => {
        const firms = await loadMyFirms(userId, sessionKey);
        seen.current = { firms, refusal: refusal(firms, address) };
        return seen.current.refusal === null;
      }}
      deniedCode="firm_member_route"
      denied={(email) => {
        const { firms, refusal: why } = seen.current;
        if (why === "several") {
          return (
            <AccessMessage title="You're a member of more than one firm">
              <p className="text-muted-foreground mb-4">
                Your account{email ? ` (${email})` : ""} belongs to {firms.map((f) => f.name).join(" and ")}. The console shows one firm's
                records at a time and can't yet keep two firms' records apart, so it stays closed to you until it can.
              </p>
              <SignOutLinks />
            </AccessMessage>
          );
        }
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
