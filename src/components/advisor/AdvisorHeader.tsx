import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import { useAuth } from "@/hooks/useAuth";
import LegalLinks from "@/components/LegalLinks";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { useMyFirms } from "@/hooks/useOwnedFirms";
import { currentFirm } from "@/lib/currentFirm";
import { fetchIsAdmin } from "@/lib/advisorApi";

const AdvisorHeader = () => {
  const { user, signOut } = useAuth();
  // The firm's pages are for its members and the platform's for the platform's admins (D-16: an admin is no member of any
  // firm). Each is offered once the database says so, and not before or when it can't be asked.
  const mine = useMyFirms();
  const firmAddress = useFirmAddress();
  const address = firmAddress.status === "known" ? firmAddress.address : null;
  const isMember = mine !== null && mine.length > 0;
  // The members and the record of who did what are for the owners of the firm the console is showing (the same firm the guard and the page
  // use), not for anyone who owns some firm: until the database says so, or if it can't be asked, the link isn't shown.
  const here = mine ? currentFirm(mine, address) : null;
  const ownsThisFirm = here !== null && "firm" in here && here.firm.role === "owner";
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => fetchIsAdmin())().then((admin) => !cancelled && setIsAdmin(admin), () => !cancelled && setIsAdmin(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  // The current firm's name (currentFirm: the address's firm, or the only firm on the bare domain).
  const badge = here && "firm" in here ? here.firm.name : isAdmin && mine?.length === 0 ? "Platform" : "Firm";
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-6 min-h-14 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <Link to="/advisor" className="flex items-center gap-2">
          <BrandMark className="w-7 h-7 text-primary" />
          <Wordmark className="text-xl whitespace-nowrap" />
          <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 ml-1">{badge}</span>
        </Link>
        <nav aria-label="Console" className="order-last w-full sm:order-none sm:w-auto flex items-center gap-4 text-sm">
          {isMember && (
            <>
          <NavLink
            to="/advisor"
            end
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Submissions
          </NavLink>
          <NavLink
            to="/advisor/outbox"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Outbox &amp; Notifications
          </NavLink>
          <NavLink
            to="/advisor/funnel"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Funnel
          </NavLink>
          <NavLink
            to="/advisor/partners"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Partners
          </NavLink>
          <NavLink
            to="/advisor/peos"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            PEOs
          </NavLink>
          <NavLink
            to="/advisor/mailbox"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Mailbox
          </NavLink>
            </>
          )}
          {isAdmin && (
            <>
          <NavLink
            to="/advisor/held"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Held mail
          </NavLink>
          <NavLink
            to="/advisor/firms"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Firms
          </NavLink>
          <NavLink
            to="/advisor/organisations"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Organisations
          </NavLink>
            </>
          )}
          {ownsThisFirm && (
            <>
          <NavLink
            to="/advisor/members"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Members
          </NavLink>
          <NavLink
            to="/advisor/activity"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Activity
          </NavLink>
            </>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <LegalLinks compact />
          <span className="hidden sm:inline">{user?.email}</span>
          <button onClick={() => void signOut()} className="flex items-center gap-1.5 hover:text-foreground">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdvisorHeader;
