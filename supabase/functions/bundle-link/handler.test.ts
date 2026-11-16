// The bundle-link function through its request and response (D-13 seam 4), the database and storage faked.
import { describe, expect, it, vi } from "vitest";
import { handleBundleLinkRequest, type BundleLinkClient, type BundleLinkDeps } from "./handler";

const ENV = { SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key" };
const TOKEN = "Abc123_-Abc123_-Abc123_-Abc123_-Abc123_-xyz"; // 43 characters, as the database makes them
const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");

const OPEN = {
  state: "open",
  company_name: "Reyes Bakery LLC",
  file_id: "EAA-2026-0042",
  version: 1,
  peo: "Insperity",
  expires_at: "2026-12-16T00:00:00+00:00",
  files: [{ n: 1, name: "EAA-2026-0042-packet-v1.pdf", what: "The packet" }],
  open_items: ["Loss runs for 2023"],
};

interface Options {
  rpc?: Record<string, { data?: unknown; error?: { code?: string; message?: string } | null }>;
  signed?: { data: { signedUrl: string } | null; error: unknown };
  fetched?: Response;
}

function setup(o: Options = {}) {
  const logs: string[] = [];
  const rpc = vi.fn(async (fn: string, _args: Record<string, unknown>) => {
    const r = o.rpc?.[fn] ?? { data: null };
    return { data: r.data ?? null, error: r.error ?? null };
  });
  const createSignedUrl = vi.fn(async (_path: string, _seconds: number) => o.signed ?? { data: { signedUrl: "https://p.supabase.co/storage/v1/object/sign/x?token=t" }, error: null });
  const from = vi.fn((_bucket: string) => ({ createSignedUrl }));
  const db: BundleLinkClient = { rpc, storage: { from } };
  const fetchFile = vi.fn(async (_url: string) => o.fetched ?? new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 }));
  const deps: BundleLinkDeps = { env: (n) => ENV[n as keyof typeof ENV], createClient: () => db, fetch: fetchFile, log: (l) => logs.push(l) };
  return { deps, rpc, from, createSignedUrl, fetchFile, logs };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://p.supabase.co/functions/v1/bundle-link", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.7, 10.0.0.1", ...headers },
    body: JSON.stringify(body),
  });

describe("bundle-link: opening a link", () => {
  // Catches: the token or the PEO's address sent to the database as they are (D-609: only hashes leave the function).
  it("answers a live link's page, asking the database with the token's and the address's hashes only", async () => {
    const t = setup({ rpc: { bundle_link_open: { data: OPEN } } });
    const res = await handleBundleLinkRequest(post({ token: TOKEN }), t.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(OPEN);
    expect(t.rpc).toHaveBeenCalledWith("bundle_link_open", { p_token_hash: await sha256(TOKEN), p_address_hash: await sha256("203.0.113.7") });
    expect(JSON.stringify(t.rpc.mock.calls)).not.toContain(TOKEN);
  });

  // Catches: a malformed token (a truncated link, a guess of the wrong shape) sent to the database, or shown as anything but the one page.
  it.each([["too short", "abc"], ["a character the database never makes", `${TOKEN.slice(0, 42)}.`], ["not text", 42], ["none", undefined]])(
    "a malformed token (%s) is gone without asking the database",
    async (_why, token) => {
      const t = setup({ rpc: { bundle_link_open: { data: OPEN } } });
      const res = await handleBundleLinkRequest(post({ token }), t.deps);
      expect(res.status).toBe(410);
      expect(await res.json()).toEqual({ state: "gone" });
      expect(t.rpc).not.toHaveBeenCalled();
    },
  );

  // Catches: a revoked, expired or unknown link, or an address over the guessing limit, answered with anything that tells them apart.
  it.each([["gone", { state: "gone" }], ["refused", { state: "refused" }]])("the database's %s is the one gone answer", async (_why, data) => {
    const t = setup({ rpc: { bundle_link_open: { data } } });
    const res = await handleBundleLinkRequest(post({ token: TOKEN }), t.deps);
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ state: "gone" });
  });

  // Catches: a failing database shown as "This link no longer works" (the PEO would give up on a live link), or the token written to the log.
  it("a database that fails is a 500 to try again, logged without the token or its hash", async () => {
    const t = setup({ rpc: { bundle_link_open: { error: { code: "XX000", message: `boom ${TOKEN}` } } } });
    const res = await handleBundleLinkRequest(post({ token: TOKEN }), t.deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something went wrong. Try again." });
    expect(t.logs).toEqual(["BUNDLE_LINK_FAILED step=open code=XX000"]);
    expect(t.logs.join(" ")).not.toContain(await sha256(TOKEN));
  });
});

describe("bundle-link: downloading a file", () => {
  const FILE = { bucket: "bundle-links", path: "11/6f1c2d3e-0000-4000-8000-000000000001/1-EAA-2026-0042-packet-v1.pdf", name: "EAA-2026-0042-packet-v1.pdf" };

  // Catches: a file served without the database's check, a signed link longer than 60 seconds, or the storage path (which names the quote
  // request and the folder) handed to the browser.
  it("asks the database for file n, signs it for 60 seconds, and passes the bytes on without the path", async () => {
    const t = setup({ rpc: { bundle_link_file: { data: FILE } } });
    const res = await handleBundleLinkRequest(post({ token: TOKEN, file: 1 }), t.deps);
    expect(t.rpc).toHaveBeenCalledWith("bundle_link_file", { p_token_hash: await sha256(TOKEN), p_n: 1, p_address_hash: await sha256("203.0.113.7") });
    expect(t.from).toHaveBeenCalledWith("bundle-links");
    expect(t.createSignedUrl).toHaveBeenCalledWith(FILE.path, 60);
    expect(t.fetchFile).toHaveBeenCalledWith("https://p.supabase.co/storage/v1/object/sign/x?token=t");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toBe(`attachment; filename*=UTF-8''EAA-2026-0042-packet-v1.pdf`);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect([...res.headers.values()].join(" ")).not.toContain(FILE.path);
  });

  // Catches: a file signed and served when the database said no (a revoked link, a withdrawn PEO, an address over its limit), or a file number
  // of the wrong kind passed to the database.
  it.each([["the database gives nothing", 1, null], ["a file number that is not a whole number", "1; drop", FILE], ["file 1.5", 1.5, FILE]])(
    "%s: gone, nothing signed",
    async (_why, file, data) => {
      const t = setup({ rpc: { bundle_link_file: { data } } });
      const res = await handleBundleLinkRequest(post({ token: TOKEN, file }), t.deps);
      expect(res.status).toBe(410);
      expect(await res.json()).toEqual({ state: "gone" });
      expect(t.createSignedUrl).not.toHaveBeenCalled();
    },
  );

  // Catches: a storage failure passed off as a file (an error page saved as the packet), or as "This link no longer works".
  it.each([
    ["the database fails", { rpc: { bundle_link_file: { error: { code: "XX000" } } } }, "BUNDLE_LINK_FAILED step=file code=XX000"],
    ["signing fails", { rpc: { bundle_link_file: { data: FILE } }, signed: { data: null, error: { message: "nope" } } }, "BUNDLE_LINK_FAILED step=sign code=unknown"],
    ["the file can't be read", { rpc: { bundle_link_file: { data: FILE } }, fetched: new Response("missing", { status: 404 }) }, "BUNDLE_LINK_FAILED step=fetch code=404"],
  ])("%s: a 500 to try again, logged without the path", async (_why, o, line) => {
    const t = setup(o as Options);
    const res = await handleBundleLinkRequest(post({ token: TOKEN, file: 1 }), t.deps);
    expect(res.status).toBe(500);
    expect(t.logs).toEqual([line]);
  });
});

describe("bundle-link: what every answer says about itself", () => {
  // Catches: a bundle page or file kept in a shared cache, a link sent on to another site in the Referer, or a page a crawler indexes.
  it.each([
    ["a page", { token: TOKEN }, { rpc: { bundle_link_open: { data: OPEN } } }],
    ["gone", { token: "short" }, {}],
    ["a file", { token: TOKEN, file: 1 }, { rpc: { bundle_link_file: { data: { bucket: "bundle-links", path: "1/x/1-a.pdf", name: "a.pdf" } } } }],
    ["a failure", { token: TOKEN }, { rpc: { bundle_link_open: { error: { code: "XX000" } } } }],
  ])("%s: no-store, no-referrer, noindex", async (_why, body, o) => {
    const t = setup(o as Options);
    const res = await handleBundleLinkRequest(post(body), t.deps);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  // Catches: the browser's preflight refused (the page could never ask), a GET that would put the token in a URL the platform logs, or a body
  // that is not JSON crashing the function.
  it("answers the preflight, refuses anything but a POST, and treats a body that is not JSON as gone", async () => {
    const t = setup();
    const url = "https://p.supabase.co/functions/v1/bundle-link";
    const pre = await handleBundleLinkRequest(new Request(url, { method: "OPTIONS" }), t.deps);
    expect(pre.status).toBe(200);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect((await handleBundleLinkRequest(new Request(`${url}?token=${TOKEN}`), t.deps)).status).toBe(405);
    const bad = await handleBundleLinkRequest(new Request(url, { method: "POST", body: "{not json" }), t.deps);
    expect(bad.status).toBe(410);
    expect(t.rpc).not.toHaveBeenCalled();
  });
});
