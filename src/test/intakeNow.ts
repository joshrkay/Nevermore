// The intake as the database holds it at a download's click, for the check every download makes first
// (src/lib/certificationCheck.ts). A test sets it, then mocks the client with `supabaseStub`:
//   vi.mock("@/integrations/supabase/client", async () => ({ supabase: (await import("@/test/intakeNow")).supabaseStub }));
export const intakeNow: { status: string; data_sha256: string | null; version: string | null } = { status: "submitted", data_sha256: null, version: null };

/** Sets the intake to what a page built from `built` sees: the same status, hash and version. */
export const intakeIs = (status: string, submission: { data_sha256?: string; version?: number }) =>
  Object.assign(intakeNow, { status, data_sha256: submission.data_sha256 ?? null, version: submission.version === undefined ? null : String(submission.version) });

/** chamber_sessions read by id, answering with `intakeNow`. */
export const supabaseStub = {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...intakeNow }, error: null }) }) }) }),
};
