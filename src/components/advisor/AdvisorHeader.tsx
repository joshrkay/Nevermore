import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { RavenLogo } from "@/components/RavenLogo";
import { useAuth } from "@/hooks/useAuth";

const AdvisorHeader = () => {
  const { user, signOut } = useAuth();
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/advisor" className="flex items-center gap-2">
          <RavenLogo className="w-7 h-7 text-primary" />
          <span className="font-display">Edgar Allan Advisory</span>
          <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 ml-1">Advisor</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
