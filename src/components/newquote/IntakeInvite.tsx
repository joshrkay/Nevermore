import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWhen } from "@/data/accountPage";
import { fetchIntakeInviteStatus, inviteClient, remindClient } from "@/lib/brokerIntake";

// New quote step 2's hand-over to the contact (CRM-Q2.2, D-1873) and step 3's waiting line (CRM-Q2.4, D-1874): the invitation to finish and certify, to the contact's own email by default, and once it is
// sent who the quote waits for. The database and the server function decide every rule (D-1755, D-1756); a refusal is shown in the words it was given.

export function IntakeInvite({ intakeId, contact }: { intakeId: string; contact: { name: string; email: string | null } | null }) {
  const [asking, setAsking] = useState(false);
  const [email, setEmail] = useState(contact?.email ?? "");
  const [reminded, setReminded] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const status = useQuery({ queryKey: ["new-quote", intakeId, "invite"], queryFn: () => fetchIntakeInviteStatus(intakeId), retry: false });
  const s = status.data;
  // Runs a send, then reads the invitation's state again; a refusal is shown, never lost.
  const run = (action: () => Promise<unknown>, done?: () => void) => {
    setProblem(null);
    void action().then(() => { done?.(); return status.refetch(); }).catch((e: unknown) => setProblem(e instanceof Error ? e.message : "Couldn't send the invitation. Try again."));
  };
  const send = () => run(() => inviteClient({ intakeId, email, name: contact?.name }));
  const alert = problem && <p role="alert" className="text-sm text-destructive">{problem}</p>;
  if (status.isPending) return null;
  if (s && s.state !== "none") {
    const who = (s.contactName ?? s.email).split(/\s+/)[0];
    return (
      <div className="space-y-1 text-sm">
        <p className="font-medium">{`Waiting for ${who} to certify`}</p>
        <p className="text-muted-foreground">{`Invited ${formatWhen(s.invitedAt.toISOString())} · ${s.lastOpenedAt ? `Last opened ${formatWhen(s.lastOpenedAt.toISOString())}` : "Not opened yet"}`}</p>
        {s.state === "expired" && <p className="text-destructive">{`The link expired ${formatWhen(s.expiresAt.toISOString())}. Remind sends a new one.`}</p>}
        {s.delivery === "failed" && <p className="text-destructive">The email didn't go out. Remind sends it again.</p>}
        <Button type="button" variant="outline" size="sm" onClick={() => run(() => remindClient(intakeId), () => setReminded(true))}>Remind</Button>
        {reminded && <p role="status">{`Reminder sent to ${who}.`}</p>}
        {alert}
      </div>
    );
  }
  if (!asking) {
    // One button (D-1909), named for the person it invites. There were two, "Invite the contact to finish and certify" and "The contact does it all", and both sent the same link: the second only skipped
    // the form. Either way the contact finishes and signs, whatever the firm has entered, so the button says who and shows where the invitation goes before anything is sent.
    const first = contact?.name.trim().split(/\s+/)[0];
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setAsking(true)}>{first ? `Invite ${first}` : "Invite the contact"}</Button>
        </div>
        {alert}
      </div>
    );
  }
  return (
    <form className="space-y-1" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="invite-email">Contact's email</Label>
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit">Send invitation</Button>
      </div>
      {alert}
    </form>
  );
}
