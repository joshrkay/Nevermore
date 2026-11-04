// Golden transcripts (US-2.3a, B-1.4): short conversations run through everything but the model. Each turn
// builds the request as the Chamber does (useLenoreChat: chatContext and the census summary), sends it to the
// real chamber-extract handler with the model stubbed to the turn's tool call, applies the answer as the Chamber
// does (transcriptExtraction, applyExtraction), and has Lenore announce readiness as ChamberPage does. What is
// checked is ours, not the model's: what the prompt names as unsettled and in what order, what is captured and
// with which status, when the intake is ready to certify, and that Lenore says so once.
import { describe, expect, it, vi } from "vitest";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "../../../src/data/chamberTypes";
import { createChatMessage, openingMessage, type ChatMessage } from "../../../src/data/chat";
import { censusSummary, isReadyToCertify, READY_MESSAGE, shouldAnnounceReady, statusesOf } from "../../../src/data/followUp";
import { applyExtraction, applyFieldAction, transcriptExtraction, type IntakeState } from "../../../src/data/provenance";
import { chatContext } from "../_shared/chatContext";
import { INTAKE_FIELDS } from "../_shared/intakeSchema";
import { isSettled } from "../_shared/followUp";
import { handleRequest, type HandlerDeps, type SupabaseLike } from "./handler";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INTAKE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RANK = new Map(INTAKE_FIELDS.map((f) => [f.key, f.rank]));

interface Turn {
  /** Something the prospect does in the workspace before writing (resolving a conflict, uploading a census). */
  act?: (state: IntakeState) => IntakeState;
  prospect: string;
  /** The model's forced tool call for this message. */
  model: Record<string, unknown>;
  expect?: {
    /** The first fields the prompt names as not yet settled, in order. */
    next?: string[];
    /** Fields the prompt must not name as unsettled. */
    notNamed?: string[];
    /** The prompt's "Ready to certify" line. */
    promptReady?: boolean;
    /** Text the prompt carries (the recent conversation, the census line). */
    promptIncludes?: string[];
    /** Ready to certify once the answer is applied. */
    ready?: boolean;
    /** Lenore said it is ready, this turn. */
    announced?: boolean;
    reply?: string;
    data?: Partial<ChamberData>;
    statuses?: Record<string, string | undefined>;
    /** The schema paths the function refused, as the extraction event records them. */
    refused?: string[];
  };
}

/** The real handler with Supabase and the model faked: the model makes `args` its tool call. */
function functionWith(args: Record<string, unknown>) {
  let prompt = "";
  const events: Record<string, unknown>[] = [];
  const client: SupabaseLike = {
    auth: { getUser: async () => ({ data: { user: { id: USER } } }) },
    rpc: async () => ({ data: true, error: null }),
    from: (table) => ({
      select: () => ({ eq: (_c, id) => ({ maybeSingle: async () => ({ data: id === INTAKE ? { id, user_id: USER } : null, error: null }) }) }),
      insert: async (row) => {
        if (table === "ai_extraction_events") events.push(row);
        return { error: null };
      },
    }),
  };
  const deps: HandlerDeps = {
    env: (name) => ({ SUPABASE_URL: "https://project.test", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", IP_HASH_SECRET: "ip", LOVABLE_API_KEY: "key" })[name],
    createClient: () => client,
    fetch: vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      prompt = JSON.parse(init!.body as string).messages[1].content;
      return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }] }), { status: 200 });
    }) as unknown as typeof fetch,
    sleep: async () => {},
    now: () => 0,
    logError: () => {},
    newRequestId: () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  };
  return { deps, prompt: () => prompt, event: () => events[0] };
}

const nextNamed = (prompt: string): string[] => {
  const line = /Not yet settled, most important first: (.*)/.exec(prompt)![1];
  return line === "none" ? [] : line.split(", ").map((f) => f.split(" ")[0]);
};

async function run(turns: Turn[], start: IntakeState = { data: { ...EMPTY_CHAMBER_DATA }, provenance: {} }) {
  let state = start;
  const transcript: ChatMessage[] = [openingMessage()];
  let readyBefore = isReadyToCertify(state.data, state.provenance);
  for (const [i, turn] of turns.entries()) {
    const at = `turn ${i + 1} ("${turn.prospect}")`;
    if (turn.act) state = turn.act(state);
    const settledBefore = INTAKE_FIELDS.filter((f) => isSettled(state.data[f.key as keyof ChamberData], state.provenance[f.key as keyof ChamberData]?.status)).map((f) => f.key);
    const message = createChatMessage("user", turn.prospect);
    transcript.push(message);

    // The request, as useLenoreChat builds it.
    const { census: _census, ...answers } = state.data;
    const census = censusSummary(state.data);
    const body = {
      message: message.text,
      ...chatContext(answers, statusesOf(state.provenance), transcript, message.id),
      census: { rows: census.rows, work_states: census.workStates },
      session_id: INTAKE,
    };
    const fn = functionWith(turn.model);
    const response = await handleRequest(
      new Request("https://project.test/functions/v1/chamber-extract", { method: "POST", headers: { Authorization: "Bearer t", "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      fn.deps,
    );
    expect(response.status, at).toBe(200);
    const out = await response.json();
    const prompt = fn.prompt();

    // What the prompt names is never settled, and is in rank order.
    const named = nextNamed(prompt);
    for (const key of named) expect(settledBefore, `${at}: the prompt names settled ${key}`).not.toContain(key);
    expect(named.map((k) => RANK.get(k)), `${at}: rank order`).toEqual([...named.map((k) => RANK.get(k))].sort((a, b) => a! - b!));
    expect(named, at).not.toContain("census");

    // The answer, as ChamberPage applies it, then Lenore's reply, then (once) her word that it is ready.
    state = applyExtraction(state, out.extracted, transcriptExtraction(message, out));
    transcript.push(createChatMessage("lenore", out.reply));
    const ready = isReadyToCertify(state.data, state.provenance);
    const announced = shouldAnnounceReady(readyBefore, ready, false, transcript);
    if (announced) transcript.push(createChatMessage("lenore", READY_MESSAGE));
    readyBefore = ready;

    const want = turn.expect ?? {};
    if (want.next) expect(named.slice(0, want.next.length), `${at}: next fields`).toEqual(want.next);
    for (const key of want.notNamed ?? []) expect(named, `${at}: names ${key}`).not.toContain(key);
    if (want.promptReady !== undefined) expect(prompt, at).toContain(`Ready to certify: ${want.promptReady ? "yes" : "no"}`);
    for (const text of want.promptIncludes ?? []) expect(prompt, at).toContain(text);
    if (want.ready !== undefined) expect(ready, `${at}: ready`).toBe(want.ready);
    if (want.announced !== undefined) expect(announced, `${at}: announced`).toBe(want.announced);
    if (want.reply !== undefined) expect(out.reply, at).toBe(want.reply);
    if (want.data) expect(state.data, at).toMatchObject(want.data);
    for (const [key, status] of Object.entries(want.statuses ?? {})) expect(state.provenance[key as keyof ChamberData]?.status, `${at}: ${key}`).toBe(status);
    if (want.refused) expect(fn.event()?.refused_paths ?? [], at).toEqual(want.refused);
  }
  return { state, transcript };
}

const said = (field: string, value: unknown, status = "confirmed", evidence?: string) => ({
  [field]: value,
  field_status: { [field]: status },
  ...(evidence ? { evidence: { [field]: evidence } } : {}),
});

describe("golden transcripts", () => {
  it("asks for the required answers in rank order, then says once that the intake is ready", async () => {
    const { transcript } = await run([
      {
        prospect: "We're Quill & Ink Bindery.",
        model: { ...said("company_name", "Quill & Ink Bindery"), reply: "A fine name. Which states do your employees work in?" },
        expect: { next: ["company_name", "states", "pay_frequency", "employee_count"], promptReady: false, ready: false, announced: false },
      },
      {
        prospect: "New York and New Jersey.",
        model: { ...said("states", ["NY", "NJ"]), reply: "Noted. How often do you run payroll?" },
        expect: { next: ["states", "pay_frequency"], notNamed: ["company_name"], ready: false },
      },
      {
        prospect: "Weekly",
        model: { ...said("pay_frequency", "weekly"), reply: "Weekly, then. How many employees do you have?" },
        // A one-word answer travels with the question it answers.
        expect: { next: ["pay_frequency", "employee_count"], promptIncludes: ["How often do you run payroll?"], ready: true, announced: true },
      },
      {
        prospect: "About 12 of us.",
        model: { ...said("employee_count", 12, "inferred"), reply: "Twelve. Who runs your payroll today?" },
        expect: { next: ["employee_count"], notNamed: ["company_name", "states", "pay_frequency"], promptReady: true, ready: true, announced: false },
      },
    ]);
    expect(transcript.filter((m) => m.text === READY_MESSAGE)).toHaveLength(1);
  });

  it("places a one-word yes against the question Lenore asked", async () => {
    await run([
      { prospect: "We're Acme.", model: { ...said("company_name", "Acme"), reply: "Do you work with any 1099 contractors?" } },
      {
        prospect: "Yes",
        model: { ...said("has_1099", true, "confirmed", "Yes"), reply: "Do any of them work in California?" },
        expect: { promptIncludes: ['{"sender":"lenore","text":"Do you work with any 1099 contractors?"}'], data: { has_1099: true }, statuses: { has_1099: "confirmed" } },
      },
    ]);
  });

  it("keeps a conflicting required answer from being ready until the prospect chooses, then says so", async () => {
    await run([
      { prospect: "We're Acme.", model: { ...said("company_name", "Acme"), reply: "Which states?" } },
      {
        prospect: "Our legal name is Acme Holdings LLC.",
        model: { ...said("company_name", "Acme Holdings LLC"), reply: "Which states?" },
        expect: { statuses: { company_name: "conflicting" }, data: { company_name: "Acme" } },
      },
      {
        prospect: "California, and we pay bi-weekly.",
        model: { states: ["CA"], pay_frequency: "bi-weekly", field_status: { states: "confirmed", pay_frequency: "confirmed" }, reply: "Thank you." },
        expect: { next: ["company_name"], ready: false, announced: false },
      },
      {
        act: (s) => applyFieldAction(s, { type: "resolve", field: "company_name", candidate: 1 }),
        prospect: "That's the right one.",
        model: { reply: "Splendid." },
        expect: { notNamed: ["company_name"], promptReady: true, ready: true, announced: true, data: { company_name: "Acme Holdings LLC" } },
      },
    ]);
  });

  it("lets an explicit correction replace an earlier answer instead of conflicting", async () => {
    await run([
      { prospect: "About 40 people.", model: { ...said("employee_count", 40), reply: "Forty." } },
      {
        prospect: "Actually it's 45, not 40.",
        model: { ...said("employee_count", 45, "confirmed", "it's 45, not 40"), corrected_fields: ["employee_count"], reply: "Forty-five." },
        expect: { data: { employee_count: 45 }, statuses: { employee_count: "confirmed" } },
      },
    ]);
  });

  it("records what the prospect doesn't know, and Lenore stops asking about it", async () => {
    await run([
      {
        prospect: "We're Acme, all in California, paid bi-weekly.",
        model: { company_name: "Acme", states: ["CA"], pay_frequency: "bi-weekly", field_status: { company_name: "confirmed", states: "confirmed", pay_frequency: "confirmed" }, reply: "How many employees?" },
        expect: { ready: true, announced: true },
      },
      {
        prospect: "Honestly I don't know the exact headcount.",
        model: { field_status: { employee_count: "unknown" }, evidence: { employee_count: "I don't know the exact headcount" }, reply: "No matter. What does the business do?" },
        expect: { next: ["employee_count"], statuses: { employee_count: "unknown" }, data: { employee_count: null } },
      },
      {
        prospect: "We bind books.",
        model: { ...said("industry", "Bookbinding", "inferred"), reply: "Which state is your headquarters in?" },
        expect: { notNamed: ["employee_count"], next: ["industry"] },
      },
    ]);
  });

  it("doesn't count an incomplete answer as settled", async () => {
    await run([
      {
        prospect: "Acme, paid monthly, a few states, mainly CA.",
        model: { company_name: "Acme", pay_frequency: "monthly", states: ["CA"], field_status: { company_name: "confirmed", pay_frequency: "confirmed", states: "incomplete" }, reply: "Which other states?" },
        expect: { ready: false, statuses: { states: "incomplete" } },
      },
      {
        prospect: "Just CA and OR.",
        model: { ...said("states", ["CA", "OR"]), reply: "Thank you." },
        expect: { next: ["states"], ready: true, announced: true, data: { states: ["CA", "OR"] } },
      },
    ]);
  });

  it("asks about the next unsettled field when the model gives no reply, never a canned question", async () => {
    await run([
      {
        prospect: "We're Acme.",
        model: said("company_name", "Acme"),
        expect: { reply: "Thank you, I've noted that. Which states do your employees work in?" },
      },
    ]);
  });

  it("refuses an answer that breaks the schema, records its path and applies nothing of it", async () => {
    await run([
      {
        prospect: "We're headquartered in Xanadu.",
        model: { ...said("hq_state", "XX"), reply: "Which state is that in?" },
        expect: { refused: ["hq_state"], data: { hq_state: null } },
      },
    ]);
  });

  it("counts the census's work states for states, and tells the model the census is in", async () => {
    const withCensus: IntakeState = {
      data: {
        ...EMPTY_CHAMBER_DATA,
        census: [
          { id: "e1", first_name: "Ada", last_name: "L", work_state: "NY", compensation_type: "salary", employment_type: "full_time", classification: "w2" },
          { id: "e2", first_name: "Bo", last_name: "M", work_state: "NJ", compensation_type: "hourly", employment_type: "part_time", classification: "w2" },
        ],
      },
      provenance: {},
    };
    await run([
      {
        prospect: "We're Acme and pay weekly.",
        model: { company_name: "Acme", pay_frequency: "weekly", field_status: { company_name: "confirmed", pay_frequency: "confirmed" }, reply: "Thank you." },
        expect: { notNamed: ["states"], promptIncludes: ["Employee census: uploaded, 2 rows"], ready: true, announced: true },
      },
    ], withCensus);
  });

  it("wraps up when nothing is left to ask", async () => {
    const data: ChamberData = { ...EMPTY_CHAMBER_DATA };
    const provenance: IntakeState["provenance"] = {};
    for (const f of INTAKE_FIELDS) {
      if (f.key === "census") continue;
      provenance[f.key as keyof ChamberData] = { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: "2026-11-04T00:00:00Z" };
    }
    Object.assign(data, { company_name: "Acme", states: ["NY"], pay_frequency: "weekly" });
    for (const key of ["company_name", "states", "pay_frequency"] as const) provenance[key] = { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-11-04T00:00:00Z" };
    await run([
      {
        prospect: "Is that everything?",
        model: {},
        expect: { next: [], promptIncludes: ["Not yet settled, most important first: none"], reply: "Thank you. That is everything I need: you can review your intake on the Review tab." },
      },
    ], { data, provenance });
  });
});
