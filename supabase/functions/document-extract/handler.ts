// The request handler for document-extract, with everything it touches passed in. index.ts wires in
// Deno, the real Supabase client and the file reader (read.ts, which needs Deno-only imports); the tests
// wire in fakes. No remote imports, so it runs under Deno and Vitest alike.
//
// Reads one uploaded document into candidate intake fields. Everything runs as the calling user: row
// security decides whether they may see the row and the stored file, and the document must belong to
// one of their intakes. Results are written to the document row only; the prospect reviews them before
// anything reaches the intake. No Social Security or bank account number is written: census sheets skip
// those columns and all text is redacted.
//
// As in chamber-extract (US-2.4a): every signed-in call leaves one extraction event, answers carry the
// request id and, on failure, a code from _shared/ai/errors.ts, and logs name an error's class, never
// its message.

import { UNAVAILABLE } from "../_shared/ai/allowance.ts";
import { checkAiBudget } from "../_shared/ai/budget.ts";
import { aiError, type AiErrorCode, type AiErrorReply } from "../_shared/ai/errors.ts";
import { recordAiEvent, type AiEvent, type EventWriter } from "../_shared/ai/events.ts";
import { unexpectedErrorLine } from "../_shared/ai/model.ts";
import { selectAdapter } from "../_shared/ai/providers.ts";
import { INTAKE_SCHEMA_VERSION } from "../_shared/intakeSchema.ts";
import { AiCallError, AiUnavailableError, askWithinBudget, DOCUMENT_MAX_TOKENS, retryLater } from "./ask.ts";
import { MAX_EXTRACT_BYTES, sha256Hex, type Candidate, type TextSection } from "./parse.ts";
import type { AskModel, Outcome } from "./read.ts";
import { PROMPT_VERSION, REPORT_TOOL } from "./schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Request-Id",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENT_COLUMNS = "id, user_id, session_id, file_name, storage_path, size_bytes, status, category, file_sha256";

type DbError = { message?: string; code?: string } | null;

/** The parts of the Supabase client this function uses. */
export interface DocumentClient extends EventWriter {
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string } | null } }> };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null; error: DbError }> } };
    update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<{ error: DbError }> };
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: DbError }>;
  };
  storage: { from: (bucket: string) => { download: (path: string) => PromiseLike<{ data: Blob | null; error: unknown }> } };
}

export interface DocumentHandlerDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) => DocumentClient;
  /** read.ts's readDocument: turns a stored file into candidates, asking the model only for free text. */
  readDocument: (bytes: Uint8Array, fileName: string, ask: AskModel) => Promise<Outcome>;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** An ISO timestamp for the row's processing and extraction times. */
  timestamp: () => string;
  logError: (line: string) => void;
  newRequestId: () => string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const errorClass = (e: unknown) => (e instanceof Error ? e.name : "unknown");

export async function handleDocumentRequest(req: Request, deps: DocumentHandlerDeps): Promise<Response> {
  const requestId = deps.newRequestId();
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reply = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  const refuse = (e: AiErrorReply) => reply({ error: e.message, code: e.code }, e.status);

  // Who is calling. A call with no signed-in user isn't recorded.
  const supabaseUrl = deps.env("SUPABASE_URL")!;
  let supabase: DocumentClient;
  let userId: string;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return refuse(aiError("unauthorized"));
    supabase = deps.createClient(supabaseUrl, deps.env("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return refuse(aiError("unauthorized"));
    userId = user.id;
  } catch (e) {
    deps.logError(unexpectedErrorLine(requestId, e));
    return refuse(aiError("internal"));
  }

  const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  const events: EventWriter | null = serviceRoleKey ? deps.createClient(supabaseUrl, serviceRoleKey) : null;
  const event: AiEvent = {
    requestId,
    functionName: "document-extract",
    userId,
    sessionId: null,
    httpStatus: 0,
    errorCode: null,
    promptVersion: PROMPT_VERSION,
    contractVersion: INTAKE_SCHEMA_VERSION,
  };
  const finish = async (body: Record<string, unknown>, status: number, code: AiErrorCode | null) => {
    event.httpStatus = status;
    event.errorCode = code;
    await recordAiEvent(events, event, deps.logError);
    return reply(body, status);
  };
  const fail = (e: AiErrorReply) => finish({ error: e.message, code: e.code }, e.status, e.code);

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return await fail(aiError("bad_request", { message: "The request body must be JSON." }));
    }
    const documentId = isObject(body) ? body.document_id : undefined;
    if (typeof documentId !== "string" || !UUID.test(documentId)) {
      return await fail(aiError("bad_request", { message: "document_id is required" }));
    }

    const { data: doc, error: docError } = await supabase.from("documents").select(DOCUMENT_COLUMNS).eq("id", documentId).maybeSingle();
    if (docError) throw new Error("document lookup failed");
    // Only the caller's own documents, attached to one of their intakes, can be read. Row security
    // lets an advisor read any document, so the owner is compared too.
    if (!doc || typeof doc.session_id !== "string" || doc.user_id !== userId) {
      return await fail(aiError("not_found", { message: "Not found" }));
    }
    event.documentId = documentId;
    event.sessionId = doc.session_id;

    const save = async (o: Outcome, code: AiErrorCode | null) => {
      const candidates = o.candidates ?? [];
      // A census found in a file filed as "Other" is filed as one; the prospect can change it back.
      const category = doc.category === "other" && candidates.some((c) => c.field === "census") ? "employee_census" : doc.category;
      const { error } = await supabase
        .from("documents")
        .update({
          status: o.status,
          category,
          extraction: {
            message: o.message ?? null,
            notes: o.notes ?? [],
            candidates,
            applied: {},
            extracted_at: deps.timestamp(),
          },
        })
        .eq("id", documentId);
      if (error) throw new Error("document update failed");
      event.documentStatus = o.status;
      event.fields = candidates.map((c) => c.field);
      return await finish({ status: o.status, ...(code ? { code } : {}) }, 200, code);
    };

    // The browser records the hash it computed; the stored bytes are the record, so they win.
    const recordHash = async (bytes: Uint8Array) => {
      const hash = await sha256Hex(bytes);
      if (hash === doc.file_sha256) return;
      const { error } = await supabase.from("documents").update({ file_sha256: hash }).eq("id", documentId);
      if (error) deps.logError(`DOCUMENT_HASH_NOT_RECORDED request=${requestId} document=${documentId} code=${error.code ?? "unknown"}`);
    };

    if (Number(doc.size_bytes ?? 0) > MAX_EXTRACT_BYTES) return await save({ status: "too_large" }, null);

    await supabase.from("documents").update({ status: "processing", processing_started_at: deps.timestamp() }).eq("id", documentId);

    // Asks the model about the document's free text, once the provider is set up and the budget allows.
    const ask = async (sections: TextSection[]): Promise<Candidate[]> => {
      const chosen = selectAdapter(deps.env, REPORT_TOOL, { maxTokens: DOCUMENT_MAX_TOKENS });
      if (!chosen.ok) {
        deps.logError(`AI_CONFIG_MISSING: ${chosen.problem}`);
        throw new AiUnavailableError(UNAVAILABLE);
      }
      event.provider = chosen.adapter.name;
      event.model = chosen.adapter.model;
      return await askWithinBudget(sections, {
        adapter: chosen.adapter,
        model: { fetch: deps.fetch, sleep: deps.sleep, now: deps.now },
        requestId,
        sessionId: event.sessionId,
        log: deps.logError,
        onResult: (result) => {
          event.attempts = result.attempts;
          event.latencyMs = result.latencyMs;
        },
        // The same budget chat spends from: the caller's quota, their address's, and the daily ceiling for everyone.
        checkBudget: () =>
          checkAiBudget({
            headers: req.headers,
            env: deps.env,
            user: supabase,
            createAdmin: (key) => deps.createClient(supabaseUrl, key),
            log: deps.logError,
          }),
      });
    };

    let outcome: Outcome;
    let code: AiErrorCode | null = null;
    try {
      const { data: blob, error: downloadError } = await supabase.storage.from("documents").download(String(doc.storage_path));
      if (downloadError || !blob) throw new Error("download failed");
      if (blob.size > MAX_EXTRACT_BYTES) {
        outcome = { status: "too_large" };
      } else {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        await recordHash(bytes);
        outcome = await deps.readDocument(bytes, String(doc.file_name), ask);
      }
    } catch (e) {
      // Not the document's fault: leave it ready to read again rather than marking it failed.
      const later = retryLater(e);
      if (later) {
        await supabase.from("documents").update({ status: "uploaded" }).eq("id", documentId);
        event.documentStatus = "uploaded";
        return await fail({ status: later.status, code: later.code, message: later.message });
      }
      if (e instanceof AiCallError) {
        code = e.code;
      } else {
        // The class only: a reader's error message can quote the file.
        deps.logError(`DOCUMENT_READ_FAILED request=${requestId} session=${event.sessionId} document=${documentId} error=${errorClass(e)}`);
        code = "internal";
      }
      outcome = { status: "failed" };
    }
    if (outcome.status === "extracted" && (outcome.candidates ?? []).length === 0) outcome = { status: "no_data", notes: outcome.notes };
    return await save(outcome, code);
  } catch (e) {
    deps.logError(unexpectedErrorLine(requestId, e));
    return await fail(aiError("internal"));
  }
}
