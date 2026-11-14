import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { exportTable, ExportRefusal, type ExportColumn, type ExportFilter, type ExportTable } from "@/lib/exportApi";
import { downloadBlob } from "@/lib/downloadFile";
import { DownloadsOffNotice, useDownloadsOff } from "@/components/workspace/downloadsOff";
import { csvFile, csvFileName } from "./csv";

/** What the database holds in one cell of an export. */
export type ExportCell = string | number | null;

/** One row as the database returned it, by column name (the columns the button asked for): what a cell's words may depend on besides its own value. */
export type ExportRow<T extends ExportTable> = { readonly [C in ExportColumn<T>]?: ExportCell };

/**
 * One column of the file: the database's name for it, the words in its header, and (when the database's value is not the words the page shows) the
 * plain text of a cell. This is the `text` of the table frame's `ColumnDefinition`, for the two pages that are not on the frame yet. It is given the
 * whole row as well as the cell's own value, because the page's words can depend on more than the value: an entry's kind is worded by its record's
 * type too, and an empty person is "A former member" only on a membership.
 */
export interface ExportColumnSpec<T extends ExportTable> {
  column: ExportColumn<T>;
  header: string;
  text?: (value: ExportCell, row: ExportRow<T>) => string;
}

interface Props<T extends ExportTable> {
  firmId: string;
  table: T;
  /** The columns showing, in the order shown. */
  columns: readonly ExportColumnSpec<T>[];
  /** The filters in force, in the shape export_table takes. */
  filters?: ExportFilter[];
  /** What the file holds, for its name before the date: "referral-partners". */
  fileName: string;
  /** What a row is, for "Exported 12 referral partners". */
  noun: { singular: string; plural: string };
}

type Phase = { kind: "idle" } | { kind: "running" } | { kind: "done"; message: string } | { kind: "refused"; refusal: ExportRefusal };

const plain = (value: ExportCell) => (value === null ? "" : String(value));

/**
 * The Export button of a table (CRM-S3.8a, D-48): asks the database for every row that matches, in the columns showing, and saves them as a CSV.
 * The file is built from what the database returns and from nothing on screen. While it runs the button says so and takes no second press; it
 * stays a real, focusable button throughout (`aria-disabled`, not `disabled`), so focus never leaves it. What happened is said once, in a polite
 * status that is there from the first press (so the answer arrives in a region that exists); a refusal is an alert beside the button and changes
 * nothing else on the page.
 */
export function ExportButton<T extends ExportTable>({ firmId, table, columns, filters = [], fileName, noun }: Props<T>) {
  // Not offered during Nevermore support: a file the browser builds from a firm's rows is a download (D-123), and support can look, not take.
  const downloadsOff = useDownloadsOff();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const button = useRef<HTMLButtonElement>(null);
  // A second press in the same breath as the first (before the state has been drawn) must not start a second export, which would be recorded twice.
  const running = useRef(false);
  const isRunning = phase.kind === "running";
  // The screen this button is on, as far as an export's file is concerned (D-245): who is signed in, the firm, the table, the filters and the columns it
  // asks for, and whether downloads are off. By value, so the page drawing the button again with equal arrays changes nothing. `belongsTo` is that
  // screen while the button is on it and null once it is gone (another page, another firm's page, the sign-in screen). The file is saved only to the
  // screen it was asked on: its name says nothing of the firm or the filters (D-235), so one that arrived on another screen would be taken for that screen's.
  const { user } = useAuth();
  const scope = JSON.stringify([user?.id ?? null, firmId, table, filters, columns.map((c) => c.column), downloadsOff]);
  const belongsTo = useRef<string | null>(null);
  useEffect(() => {
    belongsTo.current = scope;
    return () => { belongsTo.current = null; };
  }, [scope]);

  const run = async () => {
    if (running.current) return;
    running.current = true;
    setPhase({ kind: "running" });
    try {
      // One zone for both: the days a date filter means, and the day in the file's name.
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await exportTable(firmId, table, columns.map((c) => c.column), { filters, timeZone });
      if (belongsTo.current !== scope) {
        // The database has recorded it (and may have told the owners): say that no file came, since nothing on the screen it was asked on will.
        toast.message("An export you started finished after the page changed, so its file was not saved.");
        setPhase({ kind: "idle" });
        return;
      }
      // A file of headers and nothing under them is no export: the button is only offered over rows, so this is rows that went meanwhile.
      if (result.rowCount === 0) {
        setPhase({ kind: "done", message: `No ${noun.plural} to export.` });
        return;
      }
      const specs = result.columns.map((name) => columns.find((c) => c.column === name)!);
      const csv = csvFile(
        specs.map((s) => s.header),
        result.rows.map((row) => {
          const byName = Object.fromEntries(result.columns.map((name, i) => [name, row[i]])) as ExportRow<T>;
          return row.map((value, i) => (specs[i].text ?? plain)(value, byName));
        }),
      );
      downloadBlob(csv, csvFileName(fileName, result.exportedAt, timeZone));
      setPhase({ kind: "done", message: `Exported ${result.rowCount.toLocaleString("en-US")} ${result.rowCount === 1 ? noun.singular : noun.plural}.` });
    } catch (error) {
      // A refusal for a screen the person has left is nothing for them to act on.
      if (belongsTo.current !== scope) {
        setPhase({ kind: "idle" });
        return;
      }
      // Whatever it was, nothing else on the page changes. What is not a refusal (a bug of ours, a dropped connection) is said as a failure to try again.
      setPhase({ kind: "refused", refusal: error instanceof ExportRefusal ? error : new ExportRefusal("", "failed") });
    } finally {
      running.current = false;
    }
  };

  if (downloadsOff) return <DownloadsOffNotice />;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        ref={button}
        type="button"
        onClick={() => void run()}
        aria-disabled={isRunning || undefined}
        className="min-h-11 inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-border hover:bg-muted aria-disabled:opacity-60"
      >
        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
        {isRunning ? "Exporting…" : "Export"}
      </button>
      {/* From the first press on, so the answer arrives in a region that is already there (one inserted with its words is announced unreliably); before
          it, no empty live region sits on the page. */}
      {phase.kind !== "idle" && (
        <span role="status" className="text-sm text-muted-foreground">
          {phase.kind === "running" ? "Preparing the export…" : phase.kind === "done" ? phase.message : ""}
        </span>
      )}
      {phase.kind === "refused" && (
        <Refused
          refusal={phase.refusal}
          what={`the ${noun.plural}`}
          // The alert goes as the export starts again, and with it the button that was pressed: focus goes to Export, where the person started.
          onTryAgain={() => { button.current?.focus(); void run(); }}
        />
      )}
    </div>
  );
}

const actionClass = "min-h-11 px-2 text-primary underline hover:text-primary/90";

/**
 * What a refused or failed export says, in plain words and with what to do next. The database's own sentence is shown only where the contract says
 * it is meant for people (D-210: a filter or column it won't take, an export that holds too many rows); everything else is worded here, in the
 * words the failed loads use (`LoadFailed`, D-175).
 */
function Refused({ refusal, what, onTryAgain }: { refusal: ExportRefusal; what: string; onTryAgain: () => void }) {
  const { signOut } = useAuth();
  // The server no longer accepts this session: end it here too, so the route guard sends the person to sign in and back to this page.
  useEffect(() => {
    if (refusal.unauthenticated) void signOut("expired");
  }, [refusal, signOut]);

  if (refusal.unauthenticated) {
    return (
      <div role="alert" className="basis-full text-sm space-y-1">
        <p className="font-medium text-destructive">Your session has expired.</p>
        <p className="text-muted-foreground">Taking you to sign in again…</p>
      </div>
    );
  }
  switch (refusal.reason) {
    case "forbidden":
      return (
        <div role="alert" className="basis-full text-sm space-y-1">
          <p className="font-medium text-destructive">You no longer have access to this firm's records.</p>
          <p className="text-muted-foreground">If you should still have it, ask an administrator to grant it again.</p>
        </div>
      );
    case "sign_in_again":
      return (
        <div role="alert" className="basis-full text-sm space-y-1">
          <p className="font-medium text-destructive">{refusal.message}</p>
          {/* Ends this session and sends the person to sign in, back to this page; a fresh sign-in is what the database asked for (D-205). */}
          <button type="button" onClick={() => void signOut("expired")} className={actionClass}>Sign in again</button>
        </div>
      );
    case "failed":
      return (
        <div role="alert" className="basis-full text-sm space-y-1">
          <p className="font-medium text-destructive">We couldn't export {what}.</p>
          <p className="text-muted-foreground">This is usually a dropped connection or a problem on our side, not something you did.</p>
          <button type="button" onClick={onTryAgain} className={actionClass}>Try again</button>
        </div>
      );
    default:
      // too_many, invalid and support: the sentence is the contract's (exportApi.ts), written for people.
      return (
        <div role="alert" className="basis-full text-sm space-y-1">
          <p className="font-medium text-destructive">{refusal.message}</p>
        </div>
      );
  }
}
