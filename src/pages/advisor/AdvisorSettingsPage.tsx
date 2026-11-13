import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { SETTINGS_LINKS } from "@/components/workspace/menu";
import { useWorkspace } from "@/components/workspace/useWorkspace";

/**
 * Settings (story CRM-S1.1a, D-38): where the pages that have no menu item of their own are reached from. Each is a link to a
 * page that exists today; the tabs of the Settings screen replace them as their epics ship. The activity record is for
 * owners, so it is offered to owners only (the page refuses everyone else anyway).
 */
const AdvisorSettingsPage = () => {
  const { isOwner } = useWorkspace();
  const links = SETTINGS_LINKS.filter((l) => !l.ownersOnly || isOwner);
  return (
    <main className="container mx-auto px-6 py-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold mb-6">Settings</h1>
      <ul aria-label="Settings pages" className="divide-y divide-border rounded-lg border border-border bg-card">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="flex min-h-14 items-center gap-4 px-4 py-3 hover:bg-muted">
              <span className="flex-1">
                <span className="block font-semibold">{l.label}</span>
                <span className="block text-sm text-muted-foreground">{l.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
};

export default AdvisorSettingsPage;
