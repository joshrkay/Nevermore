// Scores an extraction eval run cell by cell and compares it with the committed baseline. Pure:
// runner.ts does the model calls, the file reading and writing and the printing.

import { z } from "zod";
import { isEmpty, type FieldKey, type IntakeState } from "@/data/provenance";
import type { ExpectedField, Fixture } from "./fixtures";

/**
 * One assertion's outcome. `actual` is the field's final value (for a digits check, where the digits were found; for a
 * reply check, Lenore's reply).
 */
export interface Cell {
  pass: boolean;
  actual: unknown;
  status: string | null;
}

/**
 * Keyed "<fixture>/<field>", "<fixture>/no_digits:<digits>" for a forbidden-digits check, or "<fixture>/reply<turn>:<name>"
 * for a reply check (the turn counted from 1).
 */
export type Cells = Record<string, Cell>;

export interface Baseline {
  prompt_version: number;
  provider: string;
  model: string;
  recorded_at: string;
  cells: Cells;
}

// ---------- Matching ----------

const normaliseString = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);

/** Strings trimmed and lower-cased; arrays as a sorted set of those. Numbers and booleans as they are. */
export function normalise(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map((v) => JSON.stringify(normaliseString(v)));
    return [...new Set(items)].sort().map((v) => JSON.parse(v));
  }
  return normaliseString(value);
}

export const valuesMatch = (actual: unknown, expected: unknown) =>
  Array.isArray(actual) === Array.isArray(expected) && JSON.stringify(normalise(actual)) === JSON.stringify(normalise(expected));

// Digits joined by single separators ("123-45-6789", "123 45 6789") read as one number.
const DIGIT_RUN = /\d+(?:[-\s.]\d+)*/g;

const containsDigits = (value: unknown, digits: string): boolean => {
  if (typeof value === "string") return (value.match(DIGIT_RUN) ?? []).some((run) => run.replace(/\D/g, "").includes(digits));
  if (typeof value === "number") return String(value).includes(digits);
  if (Array.isArray(value)) return value.some((v) => containsDigits(v, digits));
  if (typeof value === "object" && value !== null) return Object.values(value).some((v) => containsDigits(v, digits));
  return false;
};

/** Fields whose value, quote, conflict candidates or also_heard notes contain the digits. */
export function fieldsContainingDigits(state: IntakeState, digits: string): string[] {
  const fields = new Set([...Object.keys(state.data), ...Object.keys(state.provenance)]) as Set<FieldKey>;
  return [...fields].filter((field) => {
    const p = state.provenance[field];
    const others = [...(p?.candidates ?? []), ...(p?.also_heard ?? [])];
    const quotes = [p?.source, ...others.map((c) => c.source)].map((s) => (s?.kind === "transcript" ? s.quote : undefined));
    return containsDigits([state.data[field], quotes, others.map((c) => c.value)], digits);
  });
}

// ---------- Scoring ----------

/** The fixture's reply checks, each with its cell name and the turn's index. */
export function replyChecks(fixture: Fixture): { name: string; turn: number; pattern: RegExp }[] {
  return fixture.turns.flatMap((t, turn) => Object.entries(t.reply ?? {}).map(([check, pattern]) => ({ name: `reply${turn + 1}:${check}`, turn, pattern })));
}

/**
 * One cell per asserted field, absent field, forbidden digit sequence and reply check. A value cell needs the
 * expected value and, when named, the expected status; with none named, any status but conflicting. A reply cell
 * needs Lenore's own reply to that turn (`replies`, null where the model gave none) to match the pattern. A fixture
 * that didn't finish fails every cell.
 */
export function scoreFixture(fixture: Fixture, state: IntakeState, error: string | null = null, replies: readonly (string | null)[] = []): Cells {
  const key = (name: string) => `${fixture.id}/${name}`;
  const expected = Object.entries(fixture.expected) as [FieldKey, ExpectedField][];
  const absent = fixture.absent ?? [];
  const forbidden = fixture.forbidden_digits ?? [];
  const checks = replyChecks(fixture);
  const cells: Cells = {};

  if (error) {
    const names = [...expected.map(([field]) => field), ...absent, ...forbidden.map((d) => `no_digits:${d}`), ...checks.map((c) => c.name)];
    for (const name of names) cells[key(name)] = { pass: false, actual: `(not run: ${error})`, status: null };
    return cells;
  }

  const statusOf = (field: FieldKey) => state.provenance[field]?.status ?? null;
  for (const [field, want] of expected) {
    const actual = state.data[field] ?? null;
    // A conflict keeps the first value in data, but the prospect sees "Conflicting answers", so a
    // fixture that doesn't name a status still fails on one.
    const statusOk = want.status === undefined ? statusOf(field) !== "conflicting" : want.status === statusOf(field);
    const pass = valuesMatch(actual, want.value) && statusOk;
    cells[key(field)] = { pass, actual, status: statusOf(field) };
  }
  for (const field of absent) {
    const actual = state.data[field] ?? null;
    cells[key(field)] = { pass: isEmpty(actual), actual, status: statusOf(field) };
  }
  for (const digits of forbidden) {
    const found = fieldsContainingDigits(state, digits);
    cells[key(`no_digits:${digits}`)] = { pass: found.length === 0, actual: found, status: null };
  }
  for (const { name, turn, pattern } of checks) {
    const reply = replies[turn] ?? null;
    cells[key(name)] = { pass: reply !== null && pattern.test(reply), actual: reply ?? "(no reply)", status: null };
  }
  return cells;
}

export function accuracy(cells: Cells): { passed: number; total: number; percent: number } {
  const all = Object.values(cells);
  const passed = all.filter((c) => c.pass).length;
  return { passed, total: all.length, percent: all.length ? Math.round((passed / all.length) * 1000) / 10 : 0 };
}

const MAX_SHOWN_CHARS = 60;

export function describeCell(cell: Cell): string {
  const shown = JSON.stringify(cell.actual) ?? "null";
  const value = shown.length > MAX_SHOWN_CHARS ? `${shown.slice(0, MAX_SHOWN_CHARS - 1)}…` : shown;
  return cell.status ? `${value} (${cell.status})` : value;
}

/** One line per cell, fixture and field in columns, followed by the overall accuracy. */
export function formatTable(cells: Cells): string[] {
  const rows = Object.entries(cells).map(([k, cell]) => {
    const slash = k.indexOf("/");
    return [k.slice(0, slash), k.slice(slash + 1), cell.pass ? "pass" : "FAIL", describeCell(cell)];
  });
  const header = ["fixture", "field", "result", "actual (status)"];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r: string[]) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join("  ");
  const { passed, total, percent } = accuracy(cells);
  return [line(header), ...rows.map(line), "", `Accuracy: ${passed}/${total} cells (${percent}%)`];
}

// ---------- Baseline ----------

const cellSchema = z.object({ pass: z.boolean(), actual: z.unknown(), status: z.string().nullable() });
const baselineSchema = z.object({
  prompt_version: z.number().int().positive(),
  provider: z.string(),
  model: z.string(),
  recorded_at: z.string(),
  cells: z.record(cellSchema),
});

/** The committed baseline, or a thrown error naming what is wrong with it. */
export function parseBaseline(text: string): Baseline {
  const result = baselineSchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error(`baseline.json is not a baseline: ${result.error.issues[0]?.path.join(".") || "root"} ${result.error.issues[0]?.message}`);
  return result.data as Baseline;
}

/** The file --update-baseline writes: cells sorted by key, so a re-record diffs cleanly. */
export function formatBaseline(meta: Omit<Baseline, "cells">, cells: Cells): string {
  const sorted = Object.fromEntries(Object.keys(cells).sort().map((k) => [k, { pass: cells[k].pass, actual: cells[k].actual ?? null, status: cells[k].status }]));
  return `${JSON.stringify({ ...meta, cells: sorted }, null, 2)}\n`;
}

export interface BaselineDiff {
  /** Passed in the baseline, fail now. Any of these fails the run. */
  regressions: string[];
  /** Failed in the baseline, pass now. */
  fixed: string[];
  /** Not in the baseline: a new fixture or assertion. */
  added: string[];
  /** In the baseline but no longer asserted: a dropped assertion, or a fixture deleted or renamed. */
  removed: string[];
  unchanged: number;
}

/** Compares a run with the baseline. `only` is the --only fixture: removals are then looked for in it alone. */
export function diffBaseline(baseline: Cells, current: Cells, only: string | null = null): BaselineDiff {
  const fixtureOf = (k: string) => k.slice(0, k.indexOf("/"));
  const diff: BaselineDiff = { regressions: [], fixed: [], added: [], removed: [], unchanged: 0 };
  for (const [k, cell] of Object.entries(current)) {
    const before = baseline[k];
    if (!before) diff.added.push(k);
    else if (before.pass && !cell.pass) diff.regressions.push(k);
    else if (!before.pass && cell.pass) diff.fixed.push(k);
    else diff.unchanged += 1;
  }
  diff.removed = Object.keys(baseline).filter((k) => !(k in current) && (only === null || fixtureOf(k) === only));
  return diff;
}
