// How an intake's life is told to the prospect. The database decides it (migration 20261103090000:
// public.intake_draft_retention() and the expiry job); src/data/schemaSync.test.ts keeps the two equal.

/** How long an uncertified draft is kept after its last change before it expires. */
export const DRAFT_RETENTION_DAYS = 30;
