import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { DownloadsOffNotice, useDownloadsOff } from "@/components/workspace/downloadsOff";
import { exportedWords } from "@/data/exportTables";
import { useAuth } from "@/hooks/useAuth";
import { downloadBlob } from "@/lib/downloadFile";
import { exportRows, ExportError, type ExportTable } from "@/lib/exportApi";
import { exportFile } from "@/lib/exportFile";

type Outcome =
  | { kind: "none" }
  | { kind: "busy" }
  | { kind: "done"; table: ExportTable; count: number }
  /** The last sign-in is too old for a whole table: the person is offered a sign-in that brings them back here. */
  | { kind: "sign_in" }
  | { kind: "refused"; message: string };

const GENERIC = "Couldn't export. Try again.";
const SIGN_IN_AGAIN = "Sign in again to export a whole table.";

interface Props {
  firmId: string;
  table: ExportTable;
  /** The table's own filters as the page shows them now (`{}` for none), exactly as `exportRows` takes them: the file holds the rows that match. */
  filters?: Record<string, string>;
}

/**
 * "Export": a CSV of every row of a table that matches the page's filters (story CRM-S3.8a, D-48). It is one call to the database, which decides what the
 * person may take, records the export in the firm's record and gives the rows; this makes them a file and says how many, or says in words why not.
 * Nevermore support is offered no download (ADR 0024): where the button was, one plain line says so, and nothing is asked of the database.
 */
export function ExportControl({ firmId, table, filters = {} }: Props) {
  const off = useDownloadsOff();
  const { signOut } = useAuth();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "none" });
  // One export at a time, however fast the clicks come.
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  if (off) return <DownloadsOffNotice />;

  const start = async () => {
    if (running.current) return;
    running.current = true;
    setOutcome({ kind: "busy" });
    let next: Outcome;
    try {
      const result = await exportRows({ firmId, table, filters });
      const { blob, name } = exportFile(result);
      downloadBlob(blob, name);
      next = { kind: "done", table: result.table, count: result.count };
    } catch (error) {
      if (error instanceof ExportError && error.kind === "signInAgain") next = { kind: "sign_in" };
      else if (error instanceof ExportError) next = { kind: "refused", message: error.message };
      else if ((error as { unauthenticated?: boolean } | null)?.unauthenticated) {
        // The server no longer accepts the session: end it, and the route guard sends the person to sign in and back to this page.
        void signOut("expired");
        next = { kind: "refused", message: (error as Error).message };
      } else next = { kind: "refused", message: GENERIC };
    }
    running.current = false;
    if (mounted.current) setOutcome(next);
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
      {outcome.kind === "sign_in" && (
        <p role="alert" className="text-sm flex flex-wrap items-center gap-2">
          {SIGN_IN_AGAIN}
          {/* The sign-in the app already has: ending the session sends the person to sign in and, afterwards, back to this page. */}
          <button type="button" onClick={() => void signOut("expired")} className="min-h-11 px-3 rounded-md border border-border hover:bg-muted">Sign in again</button>
        </p>
      )}
      <button
        type="button"
        onClick={() => void start()}
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
