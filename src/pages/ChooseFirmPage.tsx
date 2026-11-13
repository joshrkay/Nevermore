import { Building2 } from "lucide-react";
import RequireAccess, { AccessMessage } from "@/components/RequireAccess";
import LegalLinks from "@/components/LegalLinks";
import { useAuth } from "@/hooks/useAuth";
import { loadMyFirms, useMyFirms } from "@/hooks/useOwnedFirms";
import { firmUrlFrom } from "@/lib/firmHost";

/**
 * "Choose a firm" (story CRM-S1.1b, D-40, ADR 0014). On the bare domain the database answers a person for every firm they
 * belong to, so a member of several firms works at one firm's own address, where it answers for that firm alone. This page
 * lists their firms (my_firms(), which is never narrowed) as links to each firm's address; a session belongs to one address,
 * so they sign in there. It only shows the way: the database decides what each address shows (D-18).
 */
const FirmChoices = () => {
  const { user, signOut } = useAuth();
  const firms = useMyFirms() ?? [];
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <h1 className="font-display text-2xl font-bold mb-3 text-center">Choose a firm</h1>
        <p className="text-muted-foreground mb-6 text-center">
          Your account{user?.email ? ` (${user.email})` : ""} belongs to more than one firm. Each firm has its own address, which shows
          that firm's records only. Open the one you want to work in and sign in there.
        </p>
        <ul aria-label="Your firms" className="space-y-3">
          {firms.map((f) => (
            <li key={f.firm_id}>
              <a
                href={`${firmUrlFrom(f.address)}/advisor`}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 hover:border-primary transition-colors"
              >
                <Building2 className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-medium">{f.name}</span>
                  <span className="block font-mono text-xs text-muted-foreground break-all">{new URL(firmUrlFrom(f.address)).host}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-center">
          <button onClick={() => void signOut()} className="text-primary underline hover:text-primary/90">
            Sign in with another account
          </button>
        </div>
        <div className="mt-8 flex justify-center">
          <LegalLinks />
        </div>
      </div>
    </div>
  );
};

const ChooseFirmPage = () => {
  const { user, session, signOut } = useAuth();
  const userId = user?.id ?? "";
  const sessionKey = session?.access_token ?? "";
  return (
    <RequireAccess
      check={async () => (await loadMyFirms(userId, sessionKey)).length > 0}
      deniedCode="choose_firm_route"
      denied={(email) => (
        <AccessMessage title="You aren't a member of any firm">
          <p className="text-muted-foreground mb-4">
            Your account{email ? ` (${email})` : ""} isn't a member of a firm. If you should be, ask a firm's owner to invite you.
          </p>
          <button onClick={() => void signOut()} className="text-primary underline hover:text-primary/90">
            Sign in with another account
          </button>
          <div className="mt-6 flex justify-center">
            <LegalLinks />
          </div>
        </AccessMessage>
      )}
    >
      <FirmChoices />
    </RequireAccess>
  );
};

export default ChooseFirmPage;
