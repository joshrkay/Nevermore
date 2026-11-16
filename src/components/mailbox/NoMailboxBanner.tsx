import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { fetchMyMailbox } from "@/lib/advisorApi";
import ConnectButtons from "./ConnectButtons";

/**
 * The inbox's banner for a person with no connected mailbox (story CRM-E1.4's "No mailbox" state; CRM-E1.1's pieces): "Connect your email to send from
 * here", with Connect Google and Connect Microsoft, coming back to `returnTo`. It reads `my_mailbox` itself. Connected, or while the answer is on its way
 * or failed, it shows nothing: the inbox lists the product's own threads whatever the mailbox, so a failed check is no reason to stand in front of them.
 */
const NoMailboxBanner = ({ returnTo }: { returnTo: string }) => {
  const mailbox = useQuery({ queryKey: ["my-mailbox"], queryFn: fetchMyMailbox, retry: false, staleTime: 60_000 });
  if (!mailbox.data || mailbox.data.connected) return null;
  return (
    <section aria-label="Your mailbox" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Connect your email to send from here
      </p>
      <ConnectButtons returnTo={returnTo} />
    </section>
  );
};

export default NoMailboxBanner;
