import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildUserPrompt, NEXT_FIELDS } from "../../supabase/functions/chamber-extract/prompt";
import { INTAKE_FIELDS } from "../../supabase/functions/_shared/intakeSchema";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "./chamberTypes";
import { chatAnswers } from "./chat";
import { censusSummary, statusesOf } from "./followUp";
import type { FieldStatus, ProvenanceMap } from "./provenance";
import { VOICE_PROMPT_VERSION, voiceContextUpdate } from "./voiceAgent";

const at = "2026-11-04T00:00:00Z";
const said = { kind: "transcript" as const, message_id: "v1" };
const status = (s: FieldStatus) => ({ status: s, source: said, updated_at: at });
const employee = (work_state: string) =>
  ({ id: "e1", first_name: "Ada", last_name: "L", dob: "1990-01-01", work_state, job_title: "Eng", annual_salary: 1, compensation_type: "salary", employment_type: "full_time", classification: "w2" }) as ChamberData["census"][number];

const line = (update: string, start: string) => update.split("\n").find((l) => l.startsWith(start))!.slice(start.length).trim();
const nextOf = (update: string) => line(update, "Ask about next, most important first:");
const settledOf = (update: string) => line(update, "Already settled, never ask again:");
const LABEL = new Map(INTAKE_FIELDS.map((f) => [f.key, f.label]));

describe("voiceContextUpdate (D24)", () => {
  it("names the next fields by label, most important first, the required ones marked, as many as typed chat's prompt names", () => {
    const update = voiceContextUpdate(EMPTY_CHAMBER_DATA, {});
    expect(update.split("\n")).toEqual([
      "Intake update. Field names only: an update never holds the prospect's answers.",
      "Ask about next, most important first: Company legal name (required); States of operation (required); Pay frequency (required); Employee count; Industry; HQ state; Current carrier; Renewal date",
      "Already settled, never ask again: none",
      "Employee census: not uploaded",
      expect.stringMatching(/^Entered in the workspace, never ask aloud: FEIN, on the Company tab; NAICS code, on the Company tab/),
    ]);
    expect(nextOf(update).split("; ")).toHaveLength(NEXT_FIELDS);
  });

  it("never holds an answer, only field labels", () => {
    const data: ChamberData = {
      ...EMPTY_CHAMBER_DATA,
      company_name: "Quill & Ink Bindery",
      states: ["NY", "NJ"],
      employee_count: 37,
      current_carrier: "Aetna",
      pay_frequency: "bi-weekly",
      key_challenges: "Overtime in Brooklyn",
      census: [employee("NY")],
    };
    const update = voiceContextUpdate(data, { company_name: status("inferred"), employee_count: status("conflicting") });
    for (const answer of ["Quill", "NY", "NJ", "37", "Aetna", "bi-weekly", "Brooklyn", "Ada"]) expect(update).not.toContain(answer);
  });

  it("lists answered, unknown and not-applicable fields as settled; a conflicting or incomplete one is asked about again", () => {
    const data: ChamberData = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", industry: "Bookbinding", employee_count: 12, pay_frequency: "weekly" };
    const provenance: ProvenanceMap = {
      company_name: status("inferred"),
      industry: status("confirmed"),
      employee_count: status("conflicting"),
      pay_frequency: status("incomplete"),
      hq_state: status("unknown"),
      wc_carrier: status("not_applicable"),
    };
    const update = voiceContextUpdate(data, provenance);
    expect(settledOf(update).split("; ")).toEqual(["Company legal name", "Industry", "HQ state", "Workers' comp carrier"]);
    expect(nextOf(update).split("; ").slice(0, 3)).toEqual(["States of operation (required)", "Pay frequency (required)", "Employee count"]);
  });

  it("asks about nothing once every field is settled, and never names the census, which only comes from a file", () => {
    const provenance = Object.fromEntries(INTAKE_FIELDS.map((f) => [f.key, status("unknown")])) as ProvenanceMap;
    const update = voiceContextUpdate(EMPTY_CHAMBER_DATA, provenance);
    expect(nextOf(update)).toBe("none");
    expect(settledOf(update)).not.toContain("Employee census");
    expect(settledOf(update).split("; ")).toHaveLength(INTAKE_FIELDS.length - 1);
    expect(line(update, "Entered in the workspace, never ask aloud:")).toBe("none");
    expect(voiceContextUpdate(EMPTY_CHAMBER_DATA, {})).not.toMatch(/Employee census[;(]/);
  });

  // K-1.1: a FEIN is typed into the workspace, never said aloud.
  it("never asks aloud for an answer entered in the workspace, or calls it settled while it is open: it says where it goes", () => {
    // Every table already holds a row, so the line names only the answers this case is about. Add each new table here.
    const TABLES = { owners_officers: [{ name: "Dana Reyes" }], loss_history: [{ policy_year: 2025 }], medical_plans: [{ name: "Gold PPO" }], suta_rates: [{ state: "CA" }] };
    const open = voiceContextUpdate({ ...EMPTY_CHAMBER_DATA, ...TABLES, naics_code: "541430", multiple_entities: true }, {});
    expect(nextOf(open)).not.toMatch(/FEIN|Legal entities/);
    expect(settledOf(open)).not.toMatch(/\bFEIN\b(?! count)|Legal entities/);
    expect(line(open, "Entered in the workspace, never ask aloud:")).toBe("FEIN, on the Company tab; Legal entities, on the Company tab");
    const held = voiceContextUpdate({ ...EMPTY_CHAMBER_DATA, ...TABLES, naics_code: "541430", fein: "841234567" }, {});
    expect(line(held, "Entered in the workspace, never ask aloud:")).toBe("none");
    expect(settledOf(held).split("; ")).toContain("FEIN");
    expect(held).not.toContain("4567");
  });

  it("says whether a census is in, and counts its work states as the answer about states", () => {
    const withCensus = voiceContextUpdate({ ...EMPTY_CHAMBER_DATA, census: [employee("TX")] }, {});
    expect(line(withCensus, "Employee census:")).toBe("uploaded");
    expect(nextOf(withCensus)).not.toContain("States of operation");
    expect(settledOf(withCensus)).toContain("States of operation");
  });

  it.each([
    ["nothing captured", EMPTY_CHAMBER_DATA, {}],
    ["a few answers, one in conflict", { ...EMPTY_CHAMBER_DATA, company_name: "Acme", employee_count: 12 }, { employee_count: status("conflicting") }],
    ["a census naming states", { ...EMPTY_CHAMBER_DATA, company_name: "Acme", census: [employee("TX")] }, {}],
  ] as [string, ChamberData, ProvenanceMap][])("names the same next fields as typed chat's prompt (%s)", (_label, data, provenance) => {
    const census = censusSummary(data);
    const prompt = buildUserPrompt({ message: "x", context: chatAnswers(data), statuses: statusesOf(provenance), census });
    const keys = /Not yet settled, most important first: (.*)/.exec(prompt)![1].split(", ").map((f) => f.split(" ")[0]);
    expect(nextOf(voiceContextUpdate(data, provenance)).split("; ").map((l) => l.replace(" (required)", ""))).toEqual(keys.map((k) => LABEL.get(k)));
  });
});

// docs/prompts/voice-agent-v{n}.md holds the prompt pasted into the ElevenLabs agent. These fingerprints make an edit
// to a recorded version, or to the update's wording, fail here until VOICE_PROMPT_VERSION is raised; then copy the
// file to the new version and record its fingerprints below, keeping the old ones so the history reads.
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const docOf = (version: number) => readFileSync(`docs/prompts/voice-agent-v${version}.md`, "utf8");
const fenced = (doc: string, heading: string): string | undefined =>
  new RegExp(`^## ${heading}\\n\\n\`\`\`text\\n([\\s\\S]*?)\\n\`\`\`$`, "m").exec(doc)?.[1];
const promptParts = (doc: string) => ({ firstMessage: fenced(doc, "First message"), systemPrompt: fenced(doc, "System prompt") });

const PROMPT_KNOWN: Record<number, string> = {
  // 1: conversation only, following the intake updates; answers go through chamber-extract (US-2.3b). Points to the
  // census template as typed chat does since US-2.3d (recorded before v1 was first deployed).
  1: "9e23211bb8bd3f21851753ce31aca1bc07d316bba946208fe630bdb20bda0044",
  // 2: the Nevermore rebrand. Lenore is "the intake assistant at Nevermore", warm and plain-spoken rather than gothic
  // and literary, with a friendly first message and the app's names for things; the rules are version 1's.
  2: "dd22b22a7a56652b3d33f794aefcea081768dd462f87b685b388f3025daaa18d",
  // 3: intake schema v3 (Epic K). The update names the answers entered in the workspace (the FEIN), and Lenore
  // never asks for those aloud: she says where each goes.
  3: "635d64e4377366f1e4a16b33084fe41d50c50f6a13118447d14ea20441dec598",
};
// The update's wording for fixed intakes: nothing captured, an answer with a census, and everything settled.
const UPDATES = () => [
  voiceContextUpdate(EMPTY_CHAMBER_DATA, {}),
  voiceContextUpdate({ ...EMPTY_CHAMBER_DATA, company_name: "<value>", census: [employee("TX")] }, { company_name: status("inferred") }),
  voiceContextUpdate(EMPTY_CHAMBER_DATA, Object.fromEntries(INTAKE_FIELDS.map((f) => [f.key, status("unknown")])) as ProvenanceMap),
];
const UPDATE_KNOWN: Record<number, string> = {
  1: "2ed1005fe6f2eee96f13e477db8fe187d51d8231337c217d92253ae3f0ac5b17",
  // 2: unchanged from 1 (the rebrand changed only the prompt).
  2: "2ed1005fe6f2eee96f13e477db8fe187d51d8231337c217d92253ae3f0ac5b17",
  // 3: the "Entered in the workspace" line, and v3's fields among the labels.
  3: "c92e1288f6a9008a1a5517980be158a0102496ff5eb370614527ce96d33e457c",
};

describe("Lenore's voice prompt", () => {
  const doc = docOf(VOICE_PROMPT_VERSION);
  const { firstMessage, systemPrompt } = promptParts(doc);

  it("is in the repo for the version the Chamber's updates are written for, with a first message and a system prompt", () => {
    expect(doc).toMatch(new RegExp(`^# Lenore's voice prompt, version ${VOICE_PROMPT_VERSION}\\n`));
    expect(firstMessage?.trim()).toBeTruthy();
    expect(systemPrompt?.trim()).toBeTruthy();
  });

  it.each(Object.keys(PROMPT_KNOWN).map(Number))("version %i is the prompt it was recorded as", (version) => {
    expect(existsSync(`docs/prompts/voice-agent-v${version}.md`), `docs/prompts/voice-agent-v${version}.md is kept`).toBe(true);
    expect(sha(promptParts(docOf(version))), `voice prompt v${version} changed: copy it to a new version instead`).toBe(PROMPT_KNOWN[version]);
  });

  it("its version's intake update is the wording it was recorded as", () => {
    expect(sha(UPDATES()), "the intake update changed: raise VOICE_PROMPT_VERSION and record the new fingerprints").toBe(UPDATE_KNOWN[VOICE_PROMPT_VERSION]);
  });

  it("describes every line the intake update has, in the update's own words", () => {
    for (const update of UPDATES()) {
      for (const l of update.split("\n").slice(1)) expect(systemPrompt, l).toContain(`"${l.slice(0, l.indexOf(":") + 1)}"`);
    }
  });

  it("shows an update the Chamber really sends", () => {
    const example = /```text\n(Intake update\.[\s\S]*?)\n```/.exec(doc)?.[1];
    expect(example).toBe(voiceContextUpdate({ ...EMPTY_CHAMBER_DATA, company_name: "Acme" }, {}));
  });

  it("never asks Lenore to write answers into her replies (ADR 0001)", () => {
    for (const part of [firstMessage, systemPrompt]) expect(part).not.toMatch(/<extract|extract>|JSON\s*block/i);
    expect(systemPrompt).toMatch(/never write answers down yourself/);
  });

  it("points the prospect to the census template for the roster, as typed chat does (US-2.3d, D21)", () => {
    expect(systemPrompt).toMatch(/point them to the census template on the Upload tab/);
    expect(systemPrompt).toMatch(/invite them to share one with the census template/);
  });

  it("tells her a spoken answer waits for the prospect's confirmation on the Review tab when she wraps up (D33)", () => {
    expect(systemPrompt).toMatch(/what they said aloud waits for their confirmation on the Review tab/);
    expect(systemPrompt).toMatch(/Never tell the prospect the intake is ready to certify/);
  });
});
