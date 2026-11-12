import { beforeEach, describe, expect, it, vi } from "vitest";

// The intake as the database holds it now, as PostgREST returns the columns asked for.
let stored: { status: string; submission: Record<string, unknown> | null } | null = null;
let readError: { message: string } | null = null;
const asked: { columns: string; column: string; value: unknown }[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: unknown) => ({
          maybeSingle: async () => {
            asked.push({ columns: `${table}: ${columns}`, column, value });
            if (readError) return { data: null, error: readError };
            if (!stored) return { data: null, error: null };
            const text = (v: unknown) => (v === undefined || v === null ? null : String(v));
            return { data: { status: stored.status, data_sha256: text(stored.submission?.data_sha256), version: text(stored.submission?.version) }, error: null };
          },
        }),
      }),
    }),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const { toast } = await import("sonner");
const { CHANGED_SINCE_OPENED, certificationOf, unchangedSinceOpened } = await import("./certificationCheck");
type Submission = import("@/data/manuscript").ChamberSubmission;

const hash = "a".repeat(64);
const built = certificationOf("s1", "submitted", { signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", data_sha256: hash, version: 3 } as Submission);

describe("unchangedSinceOpened: a download re-reads the certification before it gives a file", () => {
  beforeEach(() => {
    stored = { status: "submitted", submission: { data_sha256: hash, version: 3 } };
    readError = null;
    asked.length = 0;
    vi.mocked(toast.error).mockReset();
  });

  it("reads only the intake's status, hash and version, by its id, and lets the download go on while they match", async () => {
    expect(built).toEqual({ sessionId: "s1", status: "submitted", dataSha256: hash, version: 3 });
    expect(await unchangedSinceOpened(built)).toBe(true);
    expect(asked).toEqual([{ columns: "chamber_sessions: status, data_sha256:submission->>data_sha256, version:submission->>version", column: "id", value: "s1" }]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("refuses with a plain toast once the certification is withdrawn", async () => {
    stored = { status: "in_progress", submission: { data_sha256: hash, version: 3 } };
    expect(await unchangedSinceOpened(built)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(CHANGED_SINCE_OPENED);
    expect(CHANGED_SINCE_OPENED).toBe("This intake changed since you opened the page. Reload to get the certified version.");
  });

  it("refuses once the prospect has certified other answers, or the same answers again as a new version", async () => {
    stored = { status: "submitted", submission: { data_sha256: "b".repeat(64), version: 4 } };
    expect(await unchangedSinceOpened(built)).toBe(false);
    stored = { status: "submitted", submission: { data_sha256: hash, version: 4 } };
    expect(await unchangedSinceOpened(built)).toBe(false);
    // Certified before versions were numbered: only the hash tells one certification from the next.
    stored = { status: "submitted", submission: { data_sha256: "b".repeat(64) } };
    expect(await unchangedSinceOpened({ ...built, version: null })).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(3);
  });

  it("matches a certification from before hashes and versions were kept to itself", async () => {
    stored = { status: "submitted", submission: { signer_name: "Jo Sample" } };
    const older = certificationOf("s1", "submitted", { signer_name: "Jo Sample", signer_title: "CEO", signed_at: "2026-03-01T09:00:00Z" } as Submission);
    expect(older).toEqual({ sessionId: "s1", status: "submitted", dataSha256: null, version: null });
    expect(await unchangedSinceOpened(older)).toBe(true);
  });

  it("refuses when the intake can no longer be read, and says so when the check itself fails", async () => {
    stored = null;
    expect(await unchangedSinceOpened(built)).toBe(false);
    expect(toast.error).toHaveBeenLastCalledWith(CHANGED_SINCE_OPENED);
    readError = { message: "network down" };
    expect(await unchangedSinceOpened(built)).toBe(false);
    expect(toast.error).toHaveBeenLastCalledWith("We couldn't check that this is still the certified version. Please try again.");
  });
});
