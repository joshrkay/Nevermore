// The message-file function through its request and response (D-13 seam 4), the database and storage faked: a file link on a message to a contact
// (story CRM-E1.2b, slice 6.3; D-605). The database's own rules (live, 30 days, revoked, the virus check, the guessing limit, the download logged) are
// supabase/tests/conversation_files.sql's.
import { describe, expect, it, vi } from "vitest";
import { handleMessageFileRequest, type MessageFileDeps } from "./handler";
import type { BundleLinkClient } from "../bundle-link/handler";

const ENV = { SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key" };
const TOKEN = "Abc123_-Abc123_-Abc123_-Abc123_-Abc123_-xyz";
const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");

function setup(opened: unknown = { bucket: "documents", path: "u1/s1/census.xlsx", name: "census.xlsx" }) {
  const logs: string[] = [];
  const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: opened, error: null }));
  const createSignedUrl = vi.fn(async (_path: string, _seconds: number) => ({ data: { signedUrl: "https://p.supabase.co/storage/v1/object/sign/x?token=t" }, error: null }));
  const from = vi.fn((_bucket: string) => ({ createSignedUrl }));
  const db: BundleLinkClient = { rpc, storage: { from } };
  const fetchFile = vi.fn(async (_url: string) => new Response(new Uint8Array([80, 75, 3, 4]), { status: 200 }));
  const deps: MessageFileDeps = { env: (n) => ENV[n as keyof typeof ENV], createClient: () => db, fetch: fetchFile, log: (l) => logs.push(l) };
  return { deps, rpc, from, createSignedUrl, fetchFile, logs };
}

const post = (body: unknown) =>
  new Request("https://p.supabase.co/functions/v1/message-file", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.7, 10.0.0.1" }, body: JSON.stringify(body),
  });

describe("message-file", () => {
  // Catches: the token or the reader's address sent to the database as they are, a link that hands out the storage path or a lasting signed link, or a
  // download that is not the file's own bytes under its name.
  it("passes on a live link's file, as a download under its name, asking the database with hashes only and signing for 60 seconds", async () => {
    const t = setup();
    const res = await handleMessageFileRequest(post({ token: TOKEN }), t.deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toBe("attachment; filename*=UTF-8''census.xlsx");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]));
    expect(t.rpc).toHaveBeenCalledWith("conversation_file_open", { p_token_hash: await sha256(TOKEN), p_address_hash: await sha256("203.0.113.7") });
    expect(JSON.stringify(t.rpc.mock.calls)).not.toContain(TOKEN);
    expect(t.from).toHaveBeenCalledWith("documents");
    expect(t.createSignedUrl).toHaveBeenCalledWith("u1/s1/census.xlsx", 60);
  });

  // Catches: a malformed token sent to the database, a link that opens nothing answered as anything but the one "gone", or a token in a GET's URL.
  it("answers gone for a malformed token without asking, for a link the database opens nothing for, and takes no GET", async () => {
    const malformed = setup();
    expect((await handleMessageFileRequest(post({ token: "abc" }), malformed.deps)).status).toBe(410);
    expect(malformed.rpc).not.toHaveBeenCalled();
    const nothing = setup(null);
    const res = await handleMessageFileRequest(post({ token: TOKEN }), nothing.deps);
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ state: "gone" });
    expect(nothing.createSignedUrl).not.toHaveBeenCalled();
    expect((await handleMessageFileRequest(new Request("https://p.supabase.co/functions/v1/message-file"), setup().deps)).status).toBe(405);
  });
});
