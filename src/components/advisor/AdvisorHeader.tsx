import { Link, NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import { useAuth } from "@/hooks/useAuth";
import LegalLinks from "@/components/LegalLinks";
import { useOwnedFirms } from "@/lib/ownedFirms";

const AdvisorHeader = () => {
  const { user, signOut } = useAuth();
  // The record of who did what is for a firm's owners: the link is offered only once the database says the person owns a
  // firm. Until then, or if that can't be asked, it isn't shown (the page is refused to anyone else anyway).
  const firms = useOwnedFirms();
  const ownsAFirm = firms !== null && firms.length > 0;
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-6 min-h-14 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <Link to="/advisor" className="flex items-center gap-2">
          <BrandMark className="w-7 h-7 text-primary" />
          <Wordmark className="text-xl whitespace-nowrap" />
          <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 ml-1">Advisor</span>
        </Link>
        <nav aria-label="Advisor" className="order-last w-full sm:order-none sm:w-auto flex items-center gap-4 text-sm">
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
            to="/advisor/held"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Held mail
          </NavLink>
          <NavLink
            to="/advisor/mailbox"
            className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            Mailbox
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
          {ownsAFirm && (
            <NavLink
              to="/advisor/activity"
              className={({ isActive }) => (isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              Activity
            </NavLink>
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
