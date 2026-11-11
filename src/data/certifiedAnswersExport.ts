// The certified answers as a machine-readable file (L-3.3), for a PEO's or an advisor's own system: the File ID, the
// certified version, the certification as the database stamped it, and the answers, which validate against the
// published intake schema (docs/intake-schema.v2.json), each with its status as certified. The schema describes
// chamber_data alone and refuses unknown keys, so everything else sits in the envelope around `answers`; the envelope
// is described in docs/intake-schema.md, "Certified answers as JSON".
//
// Only what the prospect certified: never a PEO's own questions and answers (they go only to that PEO, in its
// supplement) and never anything an advisor wrote or did (notes, reviews, corrections, verifications). Built from the
// last certified version; offered only while that certification stands.
import type { ChamberData } from "./chamberTypes";
import { INTAKE_SCHEMA, INTAKE_SCHEMA_VERSION } from "./intakeSchema";
import type { ChamberSubmission } from "./manuscript";
import type { CertifiedIntake } from "./peoCompleteness";
import type { FieldProvenance } from "./provenance";

export interface CertifiedAnswersSource {
  intake: CertifiedIntake;
  submission: ChamberSubmission;
  fileId: string;
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
  /** The SHA-256 the database took of the answers as it stored them at certification. */
  data_sha256: string | null;
}

export interface CertifiedAnswersExport {
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
   */
  answer_status: Record<keyof ChamberData, FieldProvenance["status"] | null>;
}

/** The schema's own fields, in its order: nothing else the intake object may carry. */
const SCHEMA_FIELDS = Object.keys(INTAKE_SCHEMA.properties as Record<string, unknown>) as (keyof ChamberData)[];

/** The certified answers document. Pure: the same certification gives the same document. */
export function certifiedAnswersExport(from: CertifiedAnswersSource): CertifiedAnswersExport {
  const { intake, submission: s } = from;
  const data = intake.data;
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
      data_sha256: s.data_sha256 ?? null,
    },
    answers_schema: { id: INTAKE_SCHEMA.$id as string, version: INTAKE_SCHEMA_VERSION },
    answers: Object.fromEntries(SCHEMA_FIELDS.map((k) => [k, data[k]])) as unknown as ChamberData,
    answer_status: Object.fromEntries(SCHEMA_FIELDS.map((k) => [k, intake.provenance[k]?.status ?? null])) as CertifiedAnswersExport["answer_status"],
  };
}

/** "EAA-2026-0042-answers-v3.json". */
export const certifiedAnswersFilename = (d: Pick<CertifiedAnswersExport, "file_id" | "version">): string =>
  `${d.file_id}-answers${d.version !== null ? `-v${d.version}` : ""}.json`;
