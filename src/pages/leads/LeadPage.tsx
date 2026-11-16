import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PlaceToWrite from "@/components/conversations/PlaceToWrite";
import { LeadDetailsPanel } from "@/components/leads/LeadDetails";
import { LeadActionsProvider } from "@/components/leads/leadActions";
import { ConvertLeadDialog } from "@/components/leads/ConvertLeadDialog";
import { LeadHeader, LeadHeaderLoading } from "@/components/leads/LeadHeader";
import { ConvertedBanner, ConvertingMakes, LeadActivity, NotFitBanner } from "@/components/leads/LeadPanels";
import { LeadStatusBar } from "@/components/leads/LeadStatusBar";
import { NotFitDialog } from "@/components/leads/NotFitDialog";
import { leadKey, useLeadPageQuery } from "@/components/leads/useLeadQueries";
import { LoadFailed, NotAvailable, PlaceholderLines, PlaceholderPanel, RecordLoading, SlowLoadLine, useSlowLoad } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { ContactError } from "@/lib/contactApi";
import { reopenLead, type LeadFields, type LeadPage as Page } from "@/lib/leadPageApi";

/**
 * A lead's page (story CRM-L2.1, slice 8.5, screen 15; `/leads/:id` inside the workspace layout). The database decides who may see the lead and who may change it
 * (the level rule on its owner, D-809), and what Converted, Not a fit and the bin allow (CRM-L1.1); this draws what it answers.
 */
const LeadPage = () => {
  const { id = "" } = useParams();
  const { firm, isSupport } = useWorkspace();
  const { user } = useAuth();
  const firmId = firm?.id ?? null;
  const queryClient = useQueryClient();
  const query = useLeadPageQuery(firmId, id);
  const retry = useCallback(() => void query.refetch(), [query]);
  const waiting = firmId === null || (query.data === undefined && !query.isError);
  const slow = useSlowLoad(waiting, retry);
  const [markingNotFit, setMarkingNotFit] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [converting, setConverting] = useState(false);

  // The saved fields go on the page at once (the reload that follows confirms them, and brings the status a save may have moved); every list of the lead is
  // asked again.
  const saved = useCallback((fields: LeadFields) => {
    queryClient.setQueryData<Page | null>([...leadKey(firmId, id), "page"], (old) => (old ? { ...old, lead: { ...old.lead, ...fields } } : old));
    void queryClient.invalidateQueries({ queryKey: leadKey(firmId, id) });
  }, [queryClient, firmId, id]);

  const reopen = async () => {
    if (!firmId) return;
    setReopening(true);
    try {
      saved(await reopenLead(firmId, id));
      toast.success("Lead reopened");
    } catch (err) {
      toast.error(err instanceof ContactError && err.kind !== "failed" ? err.message : "Couldn't reopen the lead. Check your connection and try again.");
    }
    setReopening(false);
  };

  // Only the answer for this address is drawn: what is held for another lead (or firm) is not shown under it.
  const answered = query.data === null || query.data === undefined || query.data.lead.id === id;
  if (waiting || !answered) return <Frame><LeadLoading slow={slow.slow} onTryAgain={slow.tryAgain} /></Frame>;
  if (query.isError && query.data === undefined) {
    // An address whose id is no id at all (the database refuses it, 22P02) is a lead that isn't there, not a load that could work next time.
    if ((query.error as { code?: string }).code === "22P02") return <Frame><NotAvailable noun="lead" backTo="/leads" backLabel="Back to all leads" /></Frame>;
    return <Frame><LoadFailed error={query.error as Error} what="this lead" onRetry={retry} /></Frame>;
  }
  const page = query.data;
  // The same answer for a lead that is gone, another firm's, or one the person's level does not reach.
  if (!page) return <Frame><NotAvailable noun="lead" backTo="/leads" backLabel="Back to all leads" /></Frame>;
  const { lead } = page;
  // Calls, notes and tasks can be acted on only where the database will take them: not during a Nevermore support session (ADR 0024).
  const canAct = firmId !== null && !isSupport;
  const body = (
    <>
      <LeadHeader
        lead={lead}
        canEmail={lead.status !== "converted" && !page.inBin}
        onNotFit={canAct && page.canChange ? () => setMarkingNotFit(true) : null}
        onConvert={canAct && page.canChange && (lead.status === "new" || lead.status === "working") && !page.inBin ? () => setConverting(true) : null}
      />
      {lead.status === "converted" && page.converted && <ConvertedBanner on={page.stages.converted} made={page.converted} />}
      {lead.status === "not_fit" && (
        <NotFitBanner since={page.stages.notFit} reason={lead.notFitReason} onReopen={canAct && page.canReopen ? () => void reopen() : null} reopening={reopening} />
      )}
      <LeadStatusBar status={lead.status} stages={page.stages} />
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
        <div className="space-y-6 min-w-0">
          {firmId && <LeadDetailsPanel key={lead.id} firmId={firmId} lead={lead} canChange={canAct && page.canChange} onSaved={saved} />}
          {lead.status !== "converted" && <ConvertingMakes lead={lead} />}
        </div>
        <div className="min-w-0 space-y-6">
          {/* The emails with the lead and the place to write (CRM-E1.2, D-603); not on a converted lead, whose mail is its contact's now, or one in the bin. */}
          {firmId && lead.status !== "converted" && !page.inBin && (
            <PlaceToWrite
              key={`emails-${lead.id}`}
              firmId={firmId}
              recipient={{ leadId: lead.id, name: lead.name, email: lead.email, doNotEmail: false }}
              returnTo={`/leads/${lead.id}`}
              anchorId="emails"
            />
          )}
          {firmId && <LeadActivity key={lead.id} firmId={firmId} leadId={lead.id} />}
        </div>
      </div>
      {converting && firmId && (
        <ConvertLeadDialog
          firmId={firmId}
          lead={lead}
          onClose={() => setConverting(false)}
          onConverted={(made) => {
            setConverting(false);
            toast.success(`Converted into ${made.account.name}`);
            // The lead is Converted now: what the page holds is read again, and every list of it with it.
            void queryClient.invalidateQueries({ queryKey: leadKey(firmId, id) });
          }}
        />
      )}
      {markingNotFit && firmId && (
        <NotFitDialog
          firmId={firmId}
          lead={lead}
          onClose={() => setMarkingNotFit(false)}
          onMarked={(fields) => {
            setMarkingNotFit(false);
            toast.success("Marked Not a fit");
            saved(fields);
          }}
        />
      )}
    </>
  );
  return (
    <Frame>
      {canAct ? (
        <LeadActionsProvider firmId={firmId} leadId={lead.id} leadName={lead.name} userId={user?.id ?? null} canAdd={page.canAdd}>{body}</LeadActionsProvider>
      ) : body}
    </Frame>
  );
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background">
    <main className="container mx-auto px-6 py-8">{children}</main>
  </div>
);

/** What the page shows while the lead is on its way (CRM-L2.1's Loading state): the header, and the panels each under its own heading with grey lines. */
const LeadLoading = ({ slow, onTryAgain }: { slow: boolean; onTryAgain: () => void }) => (
  <RecordLoading name="lead">
    <LeadHeaderLoading />
    <SlowLoadLine loading slow={slow} onTryAgain={onTryAgain} />
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
      <div className="space-y-6">
        <PlaceholderPanel heading="Details"><PlaceholderLines count={8} /></PlaceholderPanel>
        <PlaceholderPanel heading="Converting makes"><PlaceholderLines count={3} /></PlaceholderPanel>
      </div>
      <div className="space-y-6">
        <PlaceholderPanel heading="Emails"><PlaceholderLines count={3} /></PlaceholderPanel>
        <PlaceholderPanel heading="Calls, notes and tasks"><PlaceholderLines count={4} /></PlaceholderPanel>
      </div>
    </div>
  </RecordLoading>
);

export default LeadPage;
