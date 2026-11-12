// The certified answers as a machine-readable file (L-3.3), for a PEO's or an advisor's own system: the File ID, the
// certified version, the certification as the database stamped it, and the answers, which validate against the
// current published intake schema (docs/intake-schema.v3.json while INTAKE_SCHEMA_VERSION is 3), each with its status
// as certified. The schema describes chamber_data alone and refuses unknown keys, so everything else sits in the
// envelope around `answers`; the envelope is described in docs/intake-schema.md, "Certified answers as JSON".
//
// Only what the prospect certified: never a PEO's own questions and answers (they go only to that PEO, in its
// supplement) and never anything an advisor wrote or did (notes, reviews, corrections, verifications). Built from the
// last certified version; offered only while that certification stands.
import type { ChamberData } from "./chamberTypes";
import { INTAKE_SCHEMA, INTAKE_SCHEMA_VERSION } from "./intakeSchema";
import type { ChamberSubmission } from "./manuscript";
import { isEmpty, type FieldProvenance, type ProvenanceMap } from "./provenance";

/** What the document reads: the certified answers and their status as certified, the certification, and the File ID. */
export interface CertifiedAnswersSource {
  data: ChamberData;
  provenance: ProvenanceMap;
  submission: ChamberSubmission;
  fileId: string;
}

/**
 * The certified answers a page holds, as the document reads them; null without a certification or a File ID. Only the
 * four parts: nothing else the page holds (an advisor's reviews and notes, a PEO's own answers) is carried along.
 */
export function certifiedAnswersSource(page: {
  data: ChamberData;
  provenance: ProvenanceMap;
  submission: ChamberSubmission | null;
  fileId: string | null;
}): CertifiedAnswersSource | null {
  if (!page.submission || !page.fileId) return null;
  return { data: page.data, provenance: page.provenance, submission: page.submission, fileId: page.fileId };
}

/** The certification as the database stamped it; null for what a certification from before it was kept doesn't hold. */
export interface ExportedCertification {
  signer_name: string;
  signer_title: string;
  /** As the signer's browser captured it. */
  signed_at: string;
  /** The database's own time of certifying. */
  certified_at: string | null;
  /** The version of the certification statement signed. */
  statement_version: string | null;
  /** The intake's data version the certification covered. */
  data_version: number | null;
  /**
   * The SHA-256 the database took of `chamber_data` as it stored it at certification (its jsonb text: its own key
   * order, only the keys stored). It names the stored record the certification covers; it can't be recomputed from
   * `answers`, which this file lays out in the schema's order with every key.
   */
  stored_data_sha256: string | null;
}

export interface CertifiedAnswersDocument {
  kind: "certified_intake_answers";
  kind_version: 1;
  file_id: string;
  version: number | null;
  certification: ExportedCertification;
  answers_schema: { id: string; version: number };
  answers: ChamberData;
  /**
   * Each answer's status as certified (docs/intake-schema.md, Field provenance): confirmed, inferred, incomplete,
   * conflicting, unknown or not_applicable; null where none was recorded. Never an advisor's verification since.
   * "unreadable" where the certification recorded an answer that `answers` doesn't hold: the stored value isn't one
   * this file could read, so it is left empty rather than passed off as the answer certified.
   */
  answer_status: Record<keyof ChamberData, AnswerStatus>;
}

export type AnswerStatus = FieldProvenance["status"] | "unreadable" | null;

/** Statuses that say the field holds an answer. "unknown" and "not_applicable" hold none on purpose; a conflict is told as one. */
const HOLDS_AN_ANSWER: ReadonlySet<FieldProvenance["status"]> = new Set(["confirmed", "inferred", "incomplete"]);

const statusOf = (value: unknown, p: FieldProvenance | undefined): AnswerStatus =>
  !p ? null : HOLDS_AN_ANSWER.has(p.status) && isEmpty(value) ? "unreadable" : p.status;

/** The schema's own fields, in its order: nothing else the intake object may carry. */
const SCHEMA_FIELDS = Object.keys(INTAKE_SCHEMA.properties as Record<string, unknown>) as (keyof ChamberData)[];

/** The certified answers document. Pure: the same certification gives the same document. */
export function certifiedAnswersDocument(from: CertifiedAnswersSource): CertifiedAnswersDocument {
  const { data, provenance, submission: s } = from;
  return {
    kind: "certified_intake_answers",
    kind_version: 1,
    file_id: from.fileId,
    version: s.version ?? null,
    certification: {
      signer_name: s.signer_name,
      signer_title: s.signer_title,
      signed_at: s.signed_at,
      certified_at: s.certified_at ?? null,
      statement_version: s.consent_version || s.consent_text_version || null,
      data_version: s.data_version ?? null,
      stored_data_sha256: s.data_sha256 ?? null,
    },
    answers_schema: { id: INTAKE_SCHEMA.$id as string, version: INTAKE_SCHEMA_VERSION },
    answers: Object.fromEntries(SCHEMA_FIELDS.map((k) => [k, data[k]])) as unknown as ChamberData,
    answer_status: Object.fromEntries(SCHEMA_FIELDS.map((k) => [k, statusOf(data[k], provenance[k])])) as CertifiedAnswersDocument["answer_status"],
  };
}

/** "EAA-2026-0042-answers-v3.json". */
export const certifiedAnswersFilename = (d: Pick<CertifiedAnswersDocument, "file_id" | "version">): string =>
  `${d.file_id}-answers${d.version !== null ? `-v${d.version}` : ""}.json`;
