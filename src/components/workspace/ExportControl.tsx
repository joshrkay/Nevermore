import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DownloadsOffNotice, useDownloadsOff } from "@/components/workspace/downloadsOff";
import { StepUpDialog } from "@/components/workspace/StepUpDialog";
import { exportedWords } from "@/data/exportTables";
import { useAuth } from "@/hooks/useAuth";
import { downloadBlob } from "@/lib/downloadFile";
import { exportRows, ExportError, type ExportTable } from "@/lib/exportApi";
import { exportFile, type ShownColumn } from "@/lib/exportFile";
import { stepUpWay, type StepUp } from "@/lib/stepUp";

type Outcome =
  | { kind: "none" }
  | { kind: "busy" }
  | { kind: "done"; table: ExportTable; count: number }
  /** The last sign-in is too old for a whole table: the person proves who they are again, in place, and the export goes on. */
  | { kind: "step_up"; way: StepUp }
  | { kind: "refused"; message: string };

const GENERIC = "Couldn't export. Try again.";

interface Props {
  firmId: string;
  table: ExportTable;
  /** The columns the page shows, in the order it shows them, each with its heading and how the page writes its value: the file holds these and no other. */
  columns: readonly ShownColumn[];
  /** The table's own filters as the page shows them now (`{}` for none), exactly as `exportRows` takes them: the file holds the rows that match. */
  filters?: Record<string, string>;
  /**
   * What the page keeps in its own state that the address must carry for the page to open the same way after a sign-in again (the filters). It is put in the
   * address only when the person has to sign in again from the sign-in page.
   */
  address?: Record<string, string>;
}

/**
 * "Export": a CSV of every row of a table that matches the page's filters (story CRM-S3.8a, D-48). It is one call to the database, which decides what the
 * person may take, records the export in the firm's record and gives the rows; this makes them a file of the columns the page shows and says how many,
 * or says in words why not. When the database finds the last sign-in too old for a whole table, the person proves who they are again without leaving the
 * page (the authenticator's code, or signing in again on this device), and the export is asked again with the same filters.
 * Nevermore support is offered no download (ADR 0024): where the button was, one plain line says so, and nothing is asked of the database.
 */
export function ExportControl({ firmId, table, columns, filters = {}, address = {} }: Props) {
  const off = useDownloadsOff();
  const { signOut } = useAuth();
  const [, setParams] = useSearchParams();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "none" });
  // One export at a time, however fast the clicks come.
  const running = useRef(false);
  const mounted = useRef(true);
  // The filters of the export that was refused for its sign-in, so the one that follows asks for the same rows, whatever the page shows by then.
  const asked = useRef<Record<string, string>>(filters);
  useEffect(() => () => { mounted.current = false; }, []);

  if (off) return <DownloadsOffNotice />;

  const run = async (asking: Record<string, string>) => {
    if (running.current) return;
    running.current = true;
    asked.current = asking;
    setOutcome({ kind: "busy" });
    let next: Outcome;
    try {
      const result = await exportRows({ firmId, table, filters: asking });
      const { blob, name } = exportFile(result, columns);
      downloadBlob(blob, name);
      next = { kind: "done", table: result.table, count: result.count };
    } catch (error) {
      if (error instanceof ExportError && error.kind === "signInAgain") {
        try {
          next = { kind: "step_up", way: await stepUpWay() };
        } catch {
          next = { kind: "refused", message: GENERIC };
        }
      } else if (error instanceof ExportError) next = { kind: "refused", message: error.message };
      else if ((error as { unauthenticated?: boolean } | null)?.unauthenticated) {
        // The server no longer accepts the session: end it, and the route guard sends the person to sign in and back to this page.
        void signOut("expired");
        next = { kind: "refused", message: (error as Error).message };
      } else next = { kind: "refused", message: GENERIC };
    }
    running.current = false;
    if (mounted.current) setOutcome(next);
  };

  /** For a person with nothing to type here: the page's filters go into the address, so that the page opens the same way, and this device signs in again. */
  const signInAgain = () => {
    if (Object.keys(address).length > 0) {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(address)) next.set(key, value);
        return next;
      }, { replace: true });
    }
    void signOut("step_up");
  };

  const busy = outcome.kind === "busy";
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {outcome.kind === "done" && (
        <p role="status" className="text-sm text-muted-foreground">
          {outcome.count === 0 ? "Nothing matched, so the file holds only the headings." : `${exportedWords(outcome.table, outcome.count)}.`}
        </p>
      )}
      {outcome.kind === "refused" && <p role="alert" className="text-sm text-destructive">{outcome.message}</p>}
      {outcome.kind === "step_up" && (
        <StepUpDialog
          way={outcome.way}
          onDone={() => void run(asked.current)}
          onCancel={() => setOutcome({ kind: "none" })}
          onSignInAgain={signInAgain}
        />
      )}
      <button
        type="button"
        onClick={() => void run(filters)}
        disabled={busy}
        aria-disabled={busy || undefined}
        className="min-h-11 flex items-center gap-2 border border-border text-sm px-4 rounded-md hover:bg-muted disabled:opacity-50"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {busy ? "Exporting…" : "Export"}
      </button>
    </div>
  );
}
