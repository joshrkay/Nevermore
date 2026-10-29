import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { dispatchOutbox } from "@/lib/dispatchOutbox";
import type { ChamberData } from "@/data/chamberTypes";
import type { ChatMessage } from "@/data/chat";
import { createChatMessage, parseTranscript } from "@/data/chat";
import { parseChamberData } from "@/data/chamberValidation";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { FIELD_LABELS, parseProvenance, type IntakeState, type ProvenanceMap } from "@/data/provenance";
import {
  certificationFromRow,
  NO_CERTIFICATION,
  type CertificationState,
  type ChamberSubmission,
} from "@/data/manuscript";

/**
 * Whether the prospect's latest changes are on the server. "idle" until anything changes.
 * "conflict": someone else saved this intake first. "invalid": the server refused an answer.
 * "missing": the intake no longer exists. None of the three is retried automatically.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "failed" | "conflict" | "invalid" | "missing";

/** Why a submission wasn't recorded, in words for the prospect. Plain `false` means a retry may work. */
export interface SubmitFailure {
  message: string;
}

type ServerRow = Pick<
  Database["public"]["Tables"]["chamber_sessions"]["Row"],
  "id" | "data_version" | "status" | "chamber_data" | "field_provenance" | "transcript" | "submission"
>;

interface UseChamberSessionReturn {
  sessionId: string | null;
  /** True when a requested session couldn't be opened; no replacement is created until startNew(). */
  resumeFailed: boolean;
  /** Starts a fresh intake. Never resumes an existing one. */
  startNew: () => void;
  /**
   * True when the prospect's latest unfinished intake couldn't be looked up or opened. Nothing is
   * created on top of it (that would hide it from later visits) until retryLoad() or startNew().
   */
  loadFailed: boolean;
  /** Looks for the prospect's latest unfinished intake again. */
  retryLoad: () => void;
  chamberData: ChamberData;
  /** Status and source of each captured field. */
  provenance: ProvenanceMap;
  messages: ChatMessage[];
  isLoading: boolean;
  setChamberData: (updater: ChamberData | ((prev: ChamberData) => ChamberData)) => void;
  /** Updates the data and its provenance together. */
  updateIntake: (updater: (prev: IntakeState) => IntakeState) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** With `signedDataKey` (the answers as signed, JSON), refuses to save if the answers have since changed. */
  submit: (submission: ChamberSubmission, signedDataKey?: string) => Promise<boolean | SubmitFailure>;
  /** Whether the answers are certified, or were changed after being certified. */
  certification: CertificationState;
  saveStatus: SaveStatus;
  /** Saves now, or creates the intake again if creating it failed. */
  retrySave: () => void;
  /** After status "conflict": drops the prospect's unsaved changes and shows what was saved elsewhere. */
  loadLatest: () => void;
  /** After status "conflict": saves the prospect's version over what was saved elsewhere. */
  keepMine: () => void;
  /** After status "invalid": drops the unsaved changes and reloads what the server has. */
  discardChanges: () => void;
  /** After status "invalid": which answer the server refused, in words for the prospect. */
  invalidField: string | null;
}

const OPENING_MESSAGE = "Good evening. I'm Lenore — your guide through The Chamber. As we talk, I'll fill in the workspace beside us, and you can check or correct anything there. Shall we begin with something simple — tell me a little about your business and what you do.";

const SAVE_DELAY_MS = 2000;
const SAVE_RETRY_MS = 10000;
// Browsers cap the total body size of keepalive requests at 64 KiB.
const KEEPALIVE_MAX_BYTES = 60_000;
// Raised by the database when an answer breaks a rule; its DETAIL names the field. Other 400s are not this.
const INVALID_DATA_CODE = "EA001";
const ROW_COLUMNS = "id, data_version, status, chamber_data, field_provenance, transcript, submission";

const CONFLICT_MESSAGE = "This intake changed elsewhere. Reload the latest and certify again.";
const MISSING_MESSAGE = "This intake can no longer be saved. Start a new intake to keep your answers.";

/**
 * Names the answer behind a server path such as `hq_state`, `states[2]` or
 * `employees[3].dependents[0].relationship`. Paths the form doesn't expose read as "Some of your answers".
 */
export function describeInvalidPath(path: string | null | undefined): string {
  const match = /^([a-z_0-9]+)(?:\[(\d+)\])?(.*)$/.exec(path ?? "");
  const root = match?.[1];
  if (root === "employees") {
    if (match?.[2] === undefined) return "Your employee census";
    const employee = Number(match[2]) + 1;
    return match[3].startsWith(".dependents") ? `A dependent of employee ${employee}` : `Employee ${employee} in your census`;
  }
  return root && root in FIELD_LABELS ? FIELD_LABELS[root as keyof typeof FIELD_LABELS] : "Some of your answers";
}

// jsonb doesn't keep key order, so a saved row can only be compared with what was sent by value.
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((key) => key in b && sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

// What a write sent, as the server would store it, for recognising our own write afterwards.
const asStored = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

// Whether a saved row is the result of an autosave that sent `stored`.
const matchesSave = (stored: { chamber_data: unknown; field_provenance: unknown; transcript: unknown }) => (row: ServerRow) =>
  sameJson(row.chamber_data, stored.chamber_data) &&
  sameJson(row.field_provenance, stored.field_provenance) &&
  sameJson(row.transcript, stored.transcript);

// Whether a saved row is the result of certifying `submission` over `signedData` (as stored).
const matchesSubmission = (submission: ChamberSubmission, signedData: unknown) => (row: ServerRow) => {
  const saved = row.submission as Partial<ChamberSubmission> | null;
  return row.status === "submitted" &&
    saved?.signer_name === submission.signer_name &&
    saved?.signed_at === submission.signed_at &&
    saved?.file_id === submission.file_id &&
    sameJson(row.chamber_data, signedData);
};

// A write that failed with an error may still have landed. Remember what it sent, so the row it
// left behind (one version on) is recognised later instead of being taken for another tab's save.
// Several can be pending: after repeated errors any one of them may be the one that landed.
/** The certification as the server will hold it once `data` is saved over `row`: saving different answers over a certified row withdraws it. */
function certificationAfterSaving(row: ServerRow, data: ChamberData): CertificationState {
  const fromServer = certificationFromRow(row.status, row.submission);
  return fromServer.status === "certified" && !sameJson(asStored(data), row.chamber_data)
    ? { status: "stale", submission: fromServer.submission }
    : fromServer;
}

interface Unconfirmed {
  version: number;
  writes: { stored: unknown; matches: (row: ServerRow) => boolean }[];
}
const MAX_UNCONFIRMED_WRITES = 5;

type Reconciled =
  | { kind: "own"; row: ServerRow }
  // Not the write just sent, but an earlier one whose response was lost: the newer edits still need sending.
  | { kind: "earlier"; row: ServerRow }
  | { kind: "conflict"; row: ServerRow }
  | { kind: "missing" }
  | { kind: "unreadable"; error: unknown }
  | { kind: "unchanged" };

/**
 * Resumes `requestedSessionId` when it belongs to the signed-in user. Without one, resumes their
 * latest intake that isn't submitted yet, and only starts a fresh session when there is none.
 * Only the id present on first render is used.
 */
export function useChamberSession(requestedSessionId?: string | null): UseChamberSessionReturn {
  const { user, session } = useAuth();
  // Depend on the id, not the object: token refreshes hand out a new User object.
  const userId = user?.id;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resumeFailed, setResumeFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [initRun, setInitRun] = useState(0);
  const [chamberData, setChamberDataRaw] = useState<ChamberData>(EMPTY_CHAMBER_DATA);
  const [provenance, setProvenanceRaw] = useState<ProvenanceMap>({});
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createChatMessage("lenore", OPENING_MESSAGE)]);
  const [certification, setCertification] = useState<CertificationState>(NO_CERTIFICATION);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const certificationRef = useRef(certification);
  useEffect(() => { certificationRef.current = certification; }, [certification]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  // Every write to the row (autosave, submit) runs one after another, so each starts from the version
  // the one before it returned.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  // True from the moment a write is sent until its outcome is settled, including the read-back after
  // a write that matched no row. The unload request can't know which version such a write leaves.
  const savingRef = useRef(false);
  // True after a write failed without a clear answer (see unconfirmedRef), until a write settles it.
  const outcomeUnknownRef = useRef(false);
  const unconfirmedRef = useRef<Unconfirmed | null>(null);
  // The version of the saved row this tab last saw. Every write is conditional on it.
  const versionRef = useRef<number | null>(null);
  // Why saving has stopped until the prospect acts. Mirrors saveStatus so a new edit can't undo it.
  const blockRef = useRef<"conflict" | "invalid" | "missing" | null>(null);
  // The row as another tab saved it, while the prospect decides what to do about the conflict.
  const conflictRef = useRef<ServerRow | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const mountedRef = useRef(true);
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => { accessTokenRef.current = session?.access_token ?? null; }, [session]);
  const dataRef = useRef(chamberData);
  const provenanceRef = useRef(provenance);
  const messagesRef = useRef(messages);
  const sessionIdRef = useRef(sessionId);
  const requestedIdRef = useRef(requestedSessionId ?? null);
  // Set by startNew (and by a retry after the intake couldn't be created): create, never resume.
  const forceNewRef = useRef(false);
  // Until the intake row exists nothing can be saved; this says whether creating it failed.
  const createFailedRef = useRef(false);

  // Keep refs fresh
  useEffect(() => { dataRef.current = chamberData; }, [chamberData]);
  useEffect(() => { provenanceRef.current = provenance; }, [provenance]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  const report = useCallback((status: SaveStatus) => {
    if (mountedRef.current) setSaveStatus(status);
  }, []);

  const stopTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const clearBlock = useCallback(() => {
    blockRef.current = null;
    conflictRef.current = null;
    setInvalidField(null);
  }, []);

  // The version is known again (a write succeeded or was refused, or a row was loaded), so no earlier
  // write can still be waiting to show up.
  const settleOutcome = useCallback(() => {
    unconfirmedRef.current = null;
    outcomeUnknownRef.current = false;
  }, []);

  const rememberUnconfirmed = useCallback((version: number, stored: unknown, matches: (row: ServerRow) => boolean) => {
    const current = unconfirmedRef.current?.version === version ? unconfirmedRef.current : { version, writes: [] };
    if (!current.writes.some((write) => sameJson(write.stored, stored))) {
      const writes = [...current.writes, { stored, matches }];
      // Once the first write may have landed, every later one at that version is refused, so a long outage
      // only adds writes that did not land. Keep the first for good and drop the oldest of the rest.
      current.writes = writes.length > MAX_UNCONFIRMED_WRITES ? [writes[0], ...writes.slice(-(MAX_UNCONFIRMED_WRITES - 1))] : writes;
    }
    unconfirmedRef.current = current;
  }, []);

  // Shows a loaded row exactly as the server has it. Never put the raw row in state: loading
  // rebuilds the answers in a stable key order, which the signature check depends on.
  const applyRow = useCallback((row: ServerRow) => {
    const loadedData = parseChamberData(row.chamber_data);
    const loadedMessages = parseTranscript(row.transcript);
    dataRef.current = loadedData;
    setChamberDataRaw(loadedData);
    const loadedProvenance = parseProvenance(row.field_provenance);
    provenanceRef.current = loadedProvenance;
    setProvenanceRaw(loadedProvenance);
    if (loadedMessages.length > 0) {
      messagesRef.current = loadedMessages;
      setMessages(loadedMessages);
    }
    let loadedCertification = certificationFromRow(row.status, row.submission);
    // Rows certified under looser rules can hold answers the sanitiser now changes. Saving them back would
    // make the database withdraw the certification, so show it as withdrawn rather than as certified.
    if (loadedCertification.status === "certified" && !sameJson(loadedData, row.chamber_data)) {
      loadedCertification = { status: "stale", submission: loadedCertification.submission };
    }
    certificationRef.current = loadedCertification;
    setCertification(loadedCertification);
    versionRef.current = typeof row.data_version === "number" ? row.data_version : null;
    settleOutcome();
    sessionIdRef.current = row.id;
    setSessionId(row.id);
  }, [settleOutcome]);

  const adoptVersion = useCallback((sid: string, version: unknown) => {
    if (sessionIdRef.current === sid) versionRef.current = typeof version === "number" ? version : null;
    settleOutcome();
  }, [settleOutcome]);

  // Nothing was saved and retrying may help: keep the changes and try again shortly.
  const failTransient = useCallback((reason: unknown) => {
    dirtyRef.current = true;
    outcomeUnknownRef.current = true;
    clearBlock();
    console.error("Failed to save session:", reason);
    report("failed");
    // Retry later so a transient failure isn't lost when no further edits arrive.
    if (mountedRef.current && !saveTimerRef.current) {
      saveTimerRef.current = setTimeout(() => void flushRef.current(), SAVE_RETRY_MS);
    }
  }, [clearBlock, report]);

  // The server refused an answer. Retrying the same payload would fail the same way, so wait for an edit.
  const markInvalid = useCallback((error: { message?: string; details?: string | null }) => {
    dirtyRef.current = true;
    settleOutcome();
    conflictRef.current = null;
    blockRef.current = "invalid";
    const path = error.details ?? /Invalid [a-z]+ data at ([^:]+):/.exec(error.message ?? "")?.[1];
    console.error("Failed to save session: the server refused an answer:", error);
    if (mountedRef.current) setInvalidField(describeInvalidPath(path));
    report("invalid");
  }, [report, settleOutcome]);

  const markConflict = useCallback((row: ServerRow) => {
    dirtyRef.current = true;
    settleOutcome();
    stopTimer();
    blockRef.current = "conflict";
    conflictRef.current = row;
    console.error("Failed to save session: it was changed elsewhere", { savedVersion: row.data_version });
    report("conflict");
  }, [report, settleOutcome, stopTimer]);

  const markMissing = useCallback(() => {
    dirtyRef.current = true;
    settleOutcome();
    stopTimer();
    blockRef.current = "missing";
    conflictRef.current = null;
    console.error("Failed to save session: the intake no longer exists");
    report("missing");
  }, [report, settleOutcome, stopTimer]);

  // A write matched no row. That can mean another tab saved first, but also that our own write landed
  // and its response was lost, or that the row is gone. The row as it stands tells which.
  const reconcile = useCallback(async (
    sid: string,
    sentVersion: number,
    isOwnWrite: (row: ServerRow) => boolean,
  ): Promise<Reconciled> => {
    const { data: row, error } = await supabase
      .from("chamber_sessions")
      .select(ROW_COLUMNS)
      .eq("id", sid)
      .maybeSingle();
    if (error) return { kind: "unreadable", error };
    if (!row) return { kind: "missing" };
    if (row.data_version === sentVersion) return { kind: "unchanged" };
    if (isOwnWrite(row)) return { kind: "own", row };
    // An earlier write that errored may have landed after all, leaving the row one version on. Any edits
    // typed since went out with this write, at the old version, so they still have to be sent.
    const unconfirmed = unconfirmedRef.current;
    if (unconfirmed && row.data_version === unconfirmed.version + 1 && unconfirmed.writes.some((write) => write.matches(row))) {
      return { kind: "earlier", row };
    }
    return { kind: "conflict", row };
  }, []);

  // One write of the pending changes. Resolves "again" when an earlier write turned out to have landed:
  // the row is now at the version it left, and the changes made since still have to go out.
  const saveOnce = useCallback(async (): Promise<boolean | "again"> => {
    const sid = sessionIdRef.current;
    if (!sid) {
      // The intake row is still being created (its creation saves what's pending), or creating it failed.
      if (!dirtyRef.current || !createFailedRef.current) return true;
      report("failed");
      return false;
    }
    if (!dirtyRef.current) return true;
    // Saving over someone else's changes, or into an intake that is gone, needs the prospect's say-so.
    if (blockRef.current === "conflict" || blockRef.current === "missing") return false;
    const version = versionRef.current;
    if (version === null) {
      // Never guess: without a version a save could overwrite newer changes.
      console.error("Failed to save session: the saved version of this intake is unknown");
      report("failed");
      return false;
    }
    dirtyRef.current = false;
    if (!blockRef.current) report("saving");
    const sent = {
      chamber_data: dataRef.current,
      field_provenance: provenanceRef.current,
      transcript: messagesRef.current,
    };
    let result;
    try {
      result = await supabase
        .from("chamber_sessions")
        .update({
          chamber_data: sent.chamber_data as unknown as Json,
          field_provenance: sent.field_provenance as unknown as Json,
          transcript: sent.transcript as unknown as Json,
        })
        .eq("id", sid)
        .eq("data_version", version)
        .select("id, data_version");
    } catch (error) {
      result = { data: null, error };
    }
    const { data, error } = result as { data: { data_version: number }[] | null; error: (Error & { code?: string; details?: string | null }) | null };
    // An update that matched no row (stale version, or the row is gone) reports no error, so only a
    // returned row counts as saved.
    if (!error && data && data.length > 0) {
      adoptVersion(sid, data[0].data_version);
      clearBlock();
      if (mountedRef.current) setSaveStatus(dirtyRef.current ? "saving" : "saved");
      return true;
    }
    if (error?.code === INVALID_DATA_CODE) {
      markInvalid(error);
      return false;
    }
    const stored = asStored(sent) as typeof sent;
    const isOwnWrite = matchesSave(stored);
    if (error) {
      // The request may have reached the server even though its response never reached us.
      rememberUnconfirmed(version, stored, isOwnWrite);
      failTransient(error);
      return false;
    }
    const outcome = await reconcile(sid, version, isOwnWrite);
    switch (outcome.kind) {
      case "own":
        // Our write did land; only its response was lost. Take the version, keep what is on screen.
        adoptVersion(sid, outcome.row.data_version);
        clearBlock();
        if (mountedRef.current) setSaveStatus(dirtyRef.current ? "saving" : "saved");
        return true;
      case "earlier": {
        adoptVersion(sid, outcome.row.data_version);
        clearBlock();
        // The earlier write may have been a certification whose response was lost; show what the server holds
        // once the newer answers land on top of it.
        const kept = certificationAfterSaving(outcome.row, dataRef.current);
        certificationRef.current = kept;
        setCertification(kept);
        dirtyRef.current = true;
        return "again";
      }
      case "conflict":
        markConflict(outcome.row);
        return false;
      case "missing":
        markMissing();
        return false;
      case "unreadable":
        failTransient(outcome.error);
        return false;
      default:
        failTransient("no row was updated");
        return false;
    }
  }, [adoptVersion, clearBlock, failTransient, markConflict, markInvalid, markMissing, reconcile, rememberUnconfirmed, report]);

  // Writes pending changes now. Must run inside the write queue. Resolves true once everything
  // captured so far is saved.
  const saveNow = useCallback(async (): Promise<boolean> => {
    savingRef.current = true;
    try {
      const first = await saveOnce();
      return first === "again" ? (await saveOnce()) === true : first;
    } finally {
      savingRef.current = false;
    }
  }, [saveOnce]);

  // Writes pending changes immediately. Safe to call when nothing is pending.
  // Resolves true once everything captured so far is saved.
  const flush = useCallback((): Promise<boolean> => {
    stopTimer();
    return enqueue(saveNow);
  }, [enqueue, saveNow, stopTimer]);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  // Debounced save
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    // A conflict, a refused answer or a vanished intake stays on screen until the prospect deals with it.
    if (!blockRef.current) setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    // Nothing is sent while in conflict, or once the intake is gone.
    saveTimerRef.current = blockRef.current === "conflict" || blockRef.current === "missing"
      ? null
      : setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  // Don't lose the last few seconds of edits when leaving the page.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const sid = sessionIdRef.current;
      if (!sid || !dirtyRef.current) return;
      stopTimer();
      // A normal request can be cancelled as the page unloads; a keepalive one is
      // allowed to finish, so send the pending changes straight to PostgREST.
      const body = JSON.stringify({
        chamber_data: dataRef.current,
        field_provenance: provenanceRef.current,
        transcript: messagesRef.current,
      });
      const token = accessTokenRef.current;
      const version = versionRef.current;
      // The response can't be read, so a request that can't win would silently lose the edits: ask the
      // prospect instead. That is a conflict, a refused answer, an unknown version, and any moment the
      // version is in doubt: a save still out (it may move the version on, and `v + 1` could just as well
      // be another tab's save) or a write that failed after possibly landing.
      if (token && version !== null && !blockRef.current && !savingRef.current && !outcomeUnknownRef.current
        && new Blob([body]).size <= KEEPALIVE_MAX_BYTES) {
        dirtyRef.current = false;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chamber_sessions?id=eq.${encodeURIComponent(sid)}&data_version=eq.${version}`, {
          method: "PATCH",
          keepalive: true,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body,
        }).catch(() => {});
        return;
      }
      // Not possible to send safely: start a normal save and ask the browser to
      // confirm leaving, which gives that save time to finish.
      void flush();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush();
    };
  }, [flush, stopTimer]);

  // Resume or create a session
  useEffect(() => {
    if (!userId) { setIsLoading(false); return; }
    let cancelled = false;

    const resume = async (id: string) => {
      // RLS only returns the user's own sessions.
      const { data, error } = await supabase
        .from("chamber_sessions")
        .select(ROW_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) console.error("Failed to load session:", error);
      if (!data) return false;
      applyRow(data);
      return true;
    };

    const create = async () => {
      const { data: newSession, error } = await supabase
        .from("chamber_sessions")
        .insert({
          user_id: userId,
          chamber_data: dataRef.current as unknown as Json,
          field_provenance: provenanceRef.current as unknown as Json,
          transcript: messagesRef.current as unknown as Json,
        })
        .select("id, data_version")
        .single();

      if (error || !newSession) {
        console.error("Failed to create session:", error);
        createFailedRef.current = true;
        // Nothing the prospect enters can be saved until the intake exists: say so, and offer Retry.
        if (!cancelled) setSaveStatus("failed");
      } else if (!cancelled) {
        createFailedRef.current = false;
        sessionIdRef.current = newSession.id;
        versionRef.current = typeof newSession.data_version === "number" ? newSession.data_version : null;
        setSessionId(newSession.id);
        // Anything captured while the row was being created still needs saving.
        if (dirtyRef.current) scheduleSave();
        else setSaveStatus((s) => (s === "idle" ? s : "saved"));
      }
    };

    // A returning prospect picks up their latest unfinished intake instead of starting over.
    const latestOpen = async (): Promise<{ ok: true; id: string | null } | { ok: false }> => {
      const { data, error } = await supabase
        .from("chamber_sessions")
        .select("id")
        // Advisors can read every intake; only the prospect's own count here.
        .eq("user_id", userId)
        .neq("status", "submitted")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("Failed to look up an open session:", error);
        return { ok: false };
      }
      return { ok: true, id: data?.id ?? null };
    };

    const init = async () => {
      const requested = requestedIdRef.current;
      const forceNew = forceNewRef.current;
      forceNewRef.current = false;
      let resumed = requested ? await resume(requested) : false;
      if (cancelled) return;
      if (requested && !resumed) {
        // Don't quietly swap in a blank session: the caller decides what the prospect sees.
        setResumeFailed(true);
        setIsLoading(false);
        return;
      }
      if (!resumed && !forceNew) {
        const latest = await latestOpen();
        if (cancelled) return;
        if (latest.ok && latest.id) {
          resumed = await resume(latest.id);
          if (cancelled) return;
        }
        // Couldn't check, or found it but couldn't open it. A new intake would become the latest one
        // and hide the prospect's answers from every later visit, so offer to try again instead.
        if (!latest.ok || (latest.id && !resumed)) {
          setLoadFailed(true);
          setIsLoading(false);
          return;
        }
      }
      if (!resumed) await create();
      if (!cancelled) setIsLoading(false);
    };

    init();
    return () => { cancelled = true; };
  }, [userId, scheduleSave, applyRow, initRun]);

  const startNew = useCallback(() => {
    requestedIdRef.current = null;
    forceNewRef.current = true;
    // A new row starts with its own version, and the old one's trouble doesn't follow it.
    clearBlock();
    settleOutcome();
    versionRef.current = null;
    sessionIdRef.current = null;
    setResumeFailed(false);
    setLoadFailed(false);
    setIsLoading(true);
    setInitRun((n) => n + 1);
  }, [clearBlock, settleOutcome]);

  const retryLoad = useCallback(() => {
    setLoadFailed(false);
    setIsLoading(true);
    setInitRun((n) => n + 1);
  }, []);

  const retrySave = useCallback(() => {
    if (sessionIdRef.current) {
      void flush();
    } else if (createFailedRef.current) {
      // Create the intake again from what's on screen, rather than resuming an older one over it.
      forceNewRef.current = true;
      setSaveStatus("saving");
      setInitRun((n) => n + 1);
    }
  }, [flush]);

  const loadLatest = useCallback(() => {
    const row = conflictRef.current;
    if (!row) return;
    stopTimer();
    dirtyRef.current = false;
    clearBlock();
    applyRow(row);
    report("saved");
  }, [applyRow, clearBlock, report, stopTimer]);

  const keepMine = useCallback(() => {
    const row = conflictRef.current;
    if (!row) return;
    // Save over what the other tab saved. If it has moved on again meanwhile, this conflicts again.
    versionRef.current = row.data_version;
    settleOutcome();
    // The other tab may have withdrawn the certification, and saving different answers over a certified row
    // withdraws it too, so show what the server will hold once this save lands.
    const kept = certificationAfterSaving(row, dataRef.current);
    certificationRef.current = kept;
    setCertification(kept);
    clearBlock();
    dirtyRef.current = true;
    report("saving");
    void flush();
  }, [clearBlock, flush, report, settleOutcome]);

  const discardChanges = useCallback(() => {
    stopTimer();
    void enqueue(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const { data, error } = await supabase
        .from("chamber_sessions")
        .select(ROW_COLUMNS)
        .eq("id", sid)
        .maybeSingle();
      if (error) {
        console.error("Failed to reload session:", error);
        return;
      }
      if (!data) {
        markMissing();
        return;
      }
      dirtyRef.current = false;
      clearBlock();
      applyRow(data);
      report("saved");
    });
  }, [applyRow, clearBlock, enqueue, markMissing, report, stopTimer]);

  // Certification covers the answers as they were signed. The database withdraws it the
  // moment the saved answers differ; mirror that here so the prospect sees it right away.
  const withdrawIfChanged = useCallback((prev: ChamberData, next: ChamberData) => {
    const current = certificationRef.current;
    if (current.status === "certified" && JSON.stringify(next) !== JSON.stringify(prev)) {
      const stale: CertificationState = { status: "stale", submission: current.submission };
      certificationRef.current = stale;
      setCertification(stale);
    }
  }, []);

  const setChamberData = useCallback((updater: ChamberData | ((prev: ChamberData) => ChamberData)) => {
    const prev = dataRef.current;
    const next = typeof updater === "function" ? updater(prev) : updater;
    dataRef.current = next;
    setChamberDataRaw(next);
    withdrawIfChanged(prev, next);
    scheduleSave();
  }, [scheduleSave, withdrawIfChanged]);

  const updateIntake = useCallback((updater: (prev: IntakeState) => IntakeState) => {
    // Read and write through the refs so data and provenance never come from different renders.
    const prev = dataRef.current;
    const next = updater({ data: prev, provenance: provenanceRef.current });
    dataRef.current = next.data;
    provenanceRef.current = next.provenance;
    setChamberDataRaw(next.data);
    setProvenanceRaw(next.provenance);
    withdrawIfChanged(prev, next.data);
    scheduleSave();
  }, [scheduleSave, withdrawIfChanged]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      const next = [...prev, msg];
      messagesRef.current = next;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  // Words for why saving stopped, when the prospect has to act before certifying can work.
  const blockedMessage = useCallback((): SubmitFailure | false => {
    switch (blockRef.current) {
      case "conflict": return { message: CONFLICT_MESSAGE };
      case "missing": return { message: MISSING_MESSAGE };
      case "invalid": return { message: "Some of your answers couldn't be saved. Fix them, then certify again." };
      default: return false;
    }
  }, []);

  const submit = useCallback((submission: ChamberSubmission, signedDataKey?: string) => enqueue(async (): Promise<boolean | SubmitFailure> => {
    const sid = sessionIdRef.current;
    if (!sid) return false;
    if (blockRef.current === "conflict" || blockRef.current === "missing") return blockedMessage();
    if (!(await saveNow())) return blockedMessage();
    // Answers edited while the autosave was finishing were not what the prospect signed.
    if (signedDataKey !== undefined && JSON.stringify(dataRef.current) !== signedDataKey) return false;
    const version = versionRef.current;
    if (version === null) {
      console.error("Failed to submit session: the saved version of this intake is unknown");
      return false;
    }
    const signedData = dataRef.current;
    let certifiedSubmission = { ...submission, chamber_data: signedData, field_provenance: provenanceRef.current };
    const storedData = asStored(signedData);
    const isOwnSubmission = matchesSubmission(submission, storedData);
    savingRef.current = true;
    let outcome: Reconciled | null = null;
    let updated: { data_version: number; status: string }[] | null = null;
    let error: (Error & { code?: string; details?: string | null }) | null = null;
    try {
      try {
        ({ data: updated, error } = await supabase
          .from("chamber_sessions")
          .update({
            status: "submitted",
            // Written alongside the certified copy so the two always agree, even when the saved row
            // predates fields that loading fills in (the database requires them to be identical).
            chamber_data: signedData as unknown as Json,
            submission: certifiedSubmission as unknown as Json,
          })
          .eq("id", sid)
          .eq("data_version", version)
          .select("id, data_version, status") as unknown as { data: typeof updated; error: typeof error });
      } catch (thrown) {
        error = thrown as typeof error;
      }
      if (!error && (!updated || updated.length === 0)) {
        // Matched no row: someone else saved first, or our own submission landed and its response was lost.
        outcome = await reconcile(sid, version, isOwnSubmission);
      }
    } finally {
      savingRef.current = false;
    }
    if (!error && updated && updated.length > 0) {
      if (updated[0].status !== "submitted") {
        console.error("Failed to submit session: the server did not record it as submitted", updated[0].status);
        return false;
      }
      adoptVersion(sid, updated[0].data_version);
    } else if (error?.code === INVALID_DATA_CODE) {
      markInvalid(error);
      return blockedMessage();
    } else if (error) {
      // It may have landed anyway; a later write has to be able to tell.
      rememberUnconfirmed(version, { submitted: submission, chamber_data: storedData }, isOwnSubmission);
      outcomeUnknownRef.current = true;
      console.error("Failed to submit session:", error);
      return false;
    } else if (outcome?.kind === "own" || outcome?.kind === "earlier") {
      adoptVersion(sid, outcome.row.data_version);
      if (outcome.kind === "earlier") {
        // A certification from before a lost response is the one on record; show it, not the one just signed.
        const recorded = certificationFromRow(outcome.row.status, outcome.row.submission);
        if (recorded.status !== "certified") return false; // not a certification: certifying again, from the new version, works
        certifiedSubmission = recorded.submission as typeof certifiedSubmission;
      }
    } else if (outcome?.kind === "conflict") {
      markConflict(outcome.row);
      return blockedMessage();
    } else if (outcome?.kind === "missing") {
      markMissing();
      return blockedMessage();
    } else {
      outcomeUnknownRef.current = true;
      console.error("Failed to submit session:", outcome?.kind === "unreadable" ? outcome.error : "no row was updated");
      return false;
    }
    const certified: CertificationState = { status: "certified", submission: certifiedSubmission };
    certificationRef.current = certified;
    setCertification(certified);
    // The notifications were queued with the submission; this just sends them promptly.
    dispatchOutbox();
    return true;
  }), [adoptVersion, blockedMessage, enqueue, markConflict, markInvalid, markMissing, reconcile, rememberUnconfirmed, saveNow]);

  return {
    sessionId,
    resumeFailed,
    startNew,
    loadFailed,
    retryLoad,
    chamberData,
    provenance,
    messages,
    isLoading,
    setChamberData,
    updateIntake,
    addMessage,
    setMessages,
    submit,
    certification,
    saveStatus,
    retrySave,
    loadLatest,
    keepMine,
    discardChanges,
    invalidField,
  };
}
