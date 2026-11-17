// The request handler for read-quote-document (story N-2.3), with everything it touches passed in. index.ts wires in Deno, the real Supabase client and the file reader
// (document-extract/read.ts, which needs Deno-only imports); the tests wire in fakes. No remote imports, so it runs under Deno and Vitest alike.
//
// Reads the document a quote names (the mail attachment of quotes.document_attachment_id, D-730) and proposes its figures in the shape record_quote takes. It is only a
// proposal: nothing is stored here, and nothing becomes the quote until the broker confirms through record_quote. Everything runs as the calling agent, so row security
// decides whether they may see the quote and the stored file.

import { buildPromptText, type TextSection } from "../document-extract/parse.ts";
import type { AskModel, Outcome } from "../document-extract/read.ts";
import { readJsonCapped } from "../_shared/body.ts";
import { aiError, type AiErrorReply } from "../_shared/ai/errors.ts";
import { callModel, type ModelDeps } from "../_shared/ai/model.ts";
import { selectAdapter } from "../_shared/ai/providers.ts";
import { PROPOSE_TOOL, SYSTEM_PROMPT } from "./prompt.ts";
import { shapeQuoteProposal, type QuoteProposal } from "./proposal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Request-Id",
};

/** The body is `{ "quote_id": 7 }`; it is read no further than this. */
const MAX_REQUEST_BYTES = 4 * 1024;

type DbError = { message?: string; code?: string } | null;
type Row = Record<string, unknown>;

/** The parts of the Supabase client this function uses. */
export interface QuoteReadClient {
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string } | null } }> };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError }>;
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: number) => { maybeSingle: () => PromiseLike<{ data: Row | null; error: DbError }> } };
  };
  storage: { from: (bucket: string) => { download: (path: string) => PromiseLike<{ data: Blob | null; error: unknown }> } };
}

export interface QuoteReadDeps extends Pick<ModelDeps, "fetch" | "sleep" | "now"> {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) => QuoteReadClient;
  /** document-extract's readDocument: turns a stored file into text sections, asking the model about the text. */
  readDocument: (bytes: Uint8Array, fileName: string, ask: AskModel) => Promise<Outcome>;
  logError: (line: string) => void;
  newRequestId: () => string;
}

const isObject = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);

export async function handleReadQuoteDocument(req: Request, deps: QuoteReadDeps): Promise<Response> {
  const requestId = deps.newRequestId();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reply = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });

  const refuse = (e: AiErrorReply) => reply({ error: e.message, code: e.code }, e.status);

  if (req.method !== "POST") return refuse(aiError("bad_request", { status: 405, message: "Method not allowed" }));

  const supabaseUrl = deps.env("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return refuse(aiError("unauthorized"));
  const supabase = deps.createClient(supabaseUrl, deps.env("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return refuse(aiError("unauthorized"));
  const body = await readJsonCapped(req, MAX_REQUEST_BYTES);
  if (!body.ok) {
    return refuse(body.reason === "too_large"
      ? aiError("bad_request", { status: 413, message: `The request body must be at most ${MAX_REQUEST_BYTES} bytes.` })
      : aiError("bad_request", { message: "The request body must be JSON." }));
  }
  const quoteId = isObject(body.value) ? body.value.quote_id : undefined;
  if (typeof quoteId !== "number" || !Number.isSafeInteger(quoteId) || quoteId < 1) return refuse(aiError("bad_request", { message: "quote_id is required" }));

  const { data: quote } = await supabase.from("quotes").select("id, document_attachment_id").eq("id", quoteId).maybeSingle();
  const { data: file } = await supabase.from("quote_request_message_attachments").select("id, file_name, status, storage_bucket, storage_path, size_bytes").eq("id", Number(quote?.document_attachment_id)).maybeSingle();
  const { data: blob } = await supabase.storage.from(String(file?.storage_bucket)).download(String(file?.storage_path));
  const bytes = new Uint8Array(await blob!.arrayBuffer());

  const chosen = selectAdapter(deps.env, PROPOSE_TOOL, { maxTokens: 4096 });
  let proposal: QuoteProposal = { draft: {}, sources: {} };
  const ask: AskModel = async (sections: TextSection[]) => {
    if (!chosen.ok) return [];
    const result = await callModel(chosen.adapter, { system: SYSTEM_PROMPT, user: `<quote_document>\n${buildPromptText(sections)}\n</quote_document>` }, { fetch: deps.fetch, sleep: deps.sleep, now: deps.now, timeoutMs: 30_000 });
    if (result.ok) proposal = shapeQuoteProposal(result.args, sections.map((s) => s.label));
    return [];
  };
  const outcome = await deps.readDocument(bytes, String(file?.file_name), ask);
  return reply({ status: outcome.status === "extracted" ? "proposed" : outcome.status, proposal }, 200);
}
