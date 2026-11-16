import { useCallback, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fetchMyMailbox, type MyMailbox } from "@/lib/advisorApi";
import ConnectButtons from "./ConnectButtons";

/** Sending from the person's own mail instead, with the thread's reply address in CC: offered on a send to a PEO only (wired by slice 6.6). */
export interface OwnMailOption {
  /** The conversation's reply address, which goes in CC so the reply still reaches the record. */
  replyAddress: string;
  /** Called when the person chooses to send it themselves. */
  onSendYourself: () => void;
}

export interface FirstSendOptions {
  /** The place to write, to come back to after connecting (brokerNext must keep it, D-650). */
  returnTo: string;
  ownMail?: OwnMailOption;
}

/**
 * What every place to write calls before it sends (story CRM-E1.1; slices 6.3 and 6.6 call it): with a mailbox connected it sends at once; with
 * none it sends nothing and draws `choice`, which offers to connect Google or Microsoft and, on a send to a PEO (`ownMail`), to send it from the
 * person's own mail with the reply address in CC (D-652).
 */
export function useFirstSend({ returnTo, ownMail }: FirstSendOptions): { beforeSend: (send: () => void | Promise<void>) => Promise<void>; choice: ReactNode } {
  const [asking, setAsking] = useState(false);
  const beforeSend = useCallback(async (send: () => void | Promise<void>) => {
    let mailbox: MyMailbox;
    try {
      mailbox = await fetchMyMailbox();
    } catch {
      toast.error("We couldn't check your mailbox, so nothing was sent. Try again.");
      return;
    }
    if (mailbox.connected) await send();
    else setAsking(true);
  }, []);
  const choice = (
    <Dialog open={asking} onOpenChange={setAsking}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect your email to send this</DialogTitle>
          <DialogDescription>
            It goes from your own address and is in your Sent folder. Nevermore can only send: it never reads your mail.
          </DialogDescription>
        </DialogHeader>
        <ConnectButtons returnTo={returnTo} />
        {ownMail && (
          <div className="border-t border-border pt-3 space-y-2 text-sm">
            <p>
              Or send it from your own mail with <strong className="break-all">{ownMail.replyAddress}</strong> in CC, so the reply still reaches the quote.
            </p>
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                ownMail.onSendYourself();
              }}
              className="min-h-11 px-4 rounded-md border border-border hover:bg-muted"
            >
              Send from your own mail
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
  return { beforeSend, choice };
}
