import { Link, NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import { useAuth } from "@/hooks/useAuth";
import LegalLinks from "@/components/LegalLinks";

const AdvisorHeader = () => {
  const { user, signOut } = useAuth();
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
