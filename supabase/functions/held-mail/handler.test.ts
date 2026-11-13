import { describe, expect, it, vi } from "vitest";
import { handleHeldMailRequest, PURGE_BATCH, type HeldMailClient, type HeldMailDeps } from "./handler";

const SERVICE = "service-key-abc";
const USER_JWT = "user-jwt-xyz";
const ENV = { SUPABASE_URL: "https://p.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: SERVICE };

interface Options {
  env?: Record<string, string | undefined>;
  user?: { id: string } | null;
  rpc?: Record<string, { data?: unknown; error?: { code?: string } | null } | ((args: Record<string, unknown>) => { data?: unknown; error?: { code?: string } | null })>;
  moveFails?: (from: string) => boolean;
  removeFails?: boolean;
  /** Whether the caller's own token passes the role check, as the database answers it (false: a password sign-in with no second factor). */
  roleCheck?: boolean;
}

function setup(o: Options = {}) {
  const logs: string[] = [];
  const moves: string[][] = [];
  const removes: string[][] = [];
  const order: string[] = [];
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    order.push(`rpc:${fn}`);
    const r = o.rpc?.[fn];
    const out = typeof r === "function" ? r(args) : r ?? { data: {} };
    return { data: out.data ?? null, error: out.error ?? null };
  });
  const db: HeldMailClient = {
    rpc,
    auth: { getUser: async () => ({ data: { user: o.user === undefined ? { id: "user-1" } : o.user } }) },
    storage: {
      from: () => ({
        move: async (from: string, to: string) => {
          order.push(`move:${from}`);
          moves.push([from, to]);
          return { error: o.moveFails?.(from) ? { message: "boom" } : null };
        },
        remove: async (paths: string[]) => {
          order.push("remove");
          removes.push(paths);
          return { data: [], error: o.removeFails ? { message: "boom" } : null };
        },
      }),
    },
  };
  // The caller's own client asks the database about their token; it does none of the work.
  const asked: string[] = [];
  const userDb: HeldMailClient = {
    ...db,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      asked.push(`${fn}:${JSON.stringify(args)}`);
      return { data: o.roleCheck ?? true, error: null };
    },
  };
  const createClient = vi.fn((_url: string, key: string, _options?: unknown) => (key === "anon" ? userDb : db));
  const deps: HeldMailDeps = { env: (n) => (o.env ?? ENV)[n], createClient, log: (l) => logs.push(l) };
  return { deps, rpc, moves, removes, logs, order, createClient, asked };
}

const post = (body: unknown, token: string | null = USER_JWT, method = "POST") =>
  new Request("https://x.example/held-mail", {
    method,
    headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });

const plan = (moves: { from: string; to: string }[]) => ({ plan_mail_move: { data: { moves } } });

describe("held-mail: who may call", () => {
  it("answers CORS preflights and refuses other methods", async () => {
    const s = setup();
    expect((await handleHeldMailRequest(post("", null, "OPTIONS"), s.deps)).status).toBe(204);
    expect((await handleHeldMailRequest(post("", USER_JWT, "GET"), s.deps)).status).toBe(405);
  });

  it("says so when its settings are missing", async () => {
    const s = setup({ env: { SUPABASE_URL: "https://p.supabase.co" } });
    expect((await handleHeldMailRequest(post({ action: "discard", message_id: 1 }), s.deps)).status).toBe(503);
    expect(s.logs.join("\n")).toContain("HELD_MAIL_CONFIG_MISSING");
  });

  it("refuses a call with no login, or a login that doesn't resolve to a person", async () => {
    expect((await handleHeldMailRequest(post({ action: "discard", message_id: 1 }, null), setup().deps)).status).toBe(401);
    expect((await handleHeldMailRequest(post({ action: "discard", message_id: 1 }), setup({ user: null }).deps)).status).toBe(401);
  });

  it("lets a person do nothing to the schedule's purge, and the schedule nothing but purge", async () => {
    const s = setup();
    expect((await handleHeldMailRequest(post({ action: "purge" }), s.deps)).status).toBe(401);
    expect((await handleHeldMailRequest(post({ action: "discard", message_id: 1 }, SERVICE), s.deps)).status).toBe(403);
    expect(s.rpc).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't a small JSON object, an unknown action and a missing id", async () => {
    const s = setup();
    expect((await handleHeldMailRequest(post("nope"), s.deps)).status).toBe(400);
    expect((await handleHeldMailRequest(post("[1]"), s.deps)).status).toBe(400);
    expect((await handleHeldMailRequest(post("x".repeat(5000)), s.deps)).status).toBe(413);
    expect((await handleHeldMailRequest(post({ action: "delete_all", message_id: 1 }), s.deps)).status).toBe(400);
    expect((await handleHeldMailRequest(post({ action: "discard" }), s.deps)).status).toBe(400);
    expect((await handleHeldMailRequest(post({ action: "assign", message_id: 1 }), s.deps)).status).toBe(400);
    expect((await handleHeldMailRequest(post({ action: "assign", message_id: 1, quote_request_id: "3" }), s.deps)).status).toBe(400);
  });

  it("uses the caller's own login to ask who they are, and the service key only for the work", async () => {
    const s = setup({ rpc: plan([]) });
    await handleHeldMailRequest(post({ action: "move_off", message_id: 4 }), s.deps);
    const calls = s.createClient.mock.calls;
    expect(calls.some(([, key, opt]) => key === "anon" && JSON.stringify(opt).includes(USER_JWT))).toBe(true);
    expect(s.rpc.mock.calls[0][1]).toMatchObject({ p_actor: "user-1" });
  });
});

describe("held-mail: the caller's own token has to pass the role check", () => {
  it.each([
    ["move_off", { action: "move_off", message_id: 9 }, "is_advisor:{}"],
    ["assign", { action: "assign", message_id: 9, quote_request_id: 3 }, 'has_role:{"_role":"admin"}'],
    ["discard", { action: "discard", message_id: 9 }, 'has_role:{"_role":"admin"}'],
  ])("refuses %s with 403 and does no work when the token has no second factor", async (_n, body, asked) => {
    const s = setup({ roleCheck: false, rpc: plan([{ from: "a/1", to: "held/1" }]) });
    const res = await handleHeldMailRequest(post(body), s.deps);
    expect(res.status).toBe(403);
    expect(s.asked).toEqual([asked]);
    expect(s.rpc).not.toHaveBeenCalled();
    expect(s.moves).toEqual([]);
    expect(s.removes).toEqual([]);
  });
});

describe("held-mail: moving a message", () => {
  it("moves each file, then applies, naming the person who asked", async () => {
    const s = setup({ rpc: plan([{ from: "s1/9/1-a.pdf", to: "held/9/1-a.pdf" }, { from: "s1/9/2-b.pdf", to: "held/9/2-b.pdf" }]) });
    const res = await handleHeldMailRequest(post({ action: "move_off", message_id: 9, note: "Wrong thread" }), s.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ moved: true, held: true, files: 2 });
    expect(s.order).toEqual(["rpc:plan_mail_move", "move:s1/9/1-a.pdf", "move:s1/9/2-b.pdf", "rpc:apply_mail_move"]);
    expect(s.rpc.mock.calls[1][1]).toEqual({ p_message_id: 9, p_target: null, p_actor: "user-1", p_note: "Wrong thread" });
  });

  it("assigns to the named quote request with no note", async () => {
    const s = setup({ rpc: plan([]) });
    const res = await handleHeldMailRequest(post({ action: "assign", message_id: 9, quote_request_id: 3, note: "ignored" }), s.deps);
    expect(await res.json()).toEqual({ moved: true, held: false, files: 0 });
    expect(s.rpc.mock.calls[1][1]).toEqual({ p_message_id: 9, p_target: 3, p_actor: "user-1", p_note: null });
  });

  it("puts the files back, and applies nothing, when one can't be moved", async () => {
    const s = setup({ rpc: plan([{ from: "a/1", to: "held/1" }, { from: "a/2", to: "held/2" }]), moveFails: (f) => f === "a/2" });
    const res = await handleHeldMailRequest(post({ action: "move_off", message_id: 9 }), s.deps);
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("storage_move");
    expect(s.moves).toEqual([["a/1", "held/1"], ["a/2", "held/2"], ["held/1", "a/1"]]);
    expect(s.order).not.toContain("rpc:apply_mail_move");
  });

  it("puts the files back when the database refuses the move, and says why", async () => {
    const s = setup({ rpc: { ...plan([{ from: "a/1", to: "held/1" }]), apply_mail_move: { error: { code: "55000" } } } });
    const res = await handleHeldMailRequest(post({ action: "move_off", message_id: 9 }), s.deps);
    expect(res.status).toBe(409);
    expect(s.moves).toEqual([["a/1", "held/1"], ["held/1", "a/1"]]);
  });

  it.each([["42501", 403], ["PT404", 404], ["22023", 400], ["XX000", 500]])("answers a database %s with %i and moves no file", async (code, status) => {
    const s = setup({ rpc: { plan_mail_move: { error: { code } } } });
    const res = await handleHeldMailRequest(post({ action: "assign", message_id: 9, quote_request_id: 3 }), s.deps);
    expect(res.status).toBe(status);
    expect(s.moves).toEqual([]);
  });
});

describe("held-mail: discarding", () => {
  it("removes the files before the rows go", async () => {
    const s = setup({ rpc: { plan_held_mail_discard: { data: { paths: ["held/9/1-a.pdf"] } }, finish_held_mail_discard: { data: { deleted: true } } } });
    const res = await handleHeldMailRequest(post({ action: "discard", message_id: 9 }), s.deps);
    expect(await res.json()).toEqual({ deleted: true, files: 1 });
    expect(s.order).toEqual(["rpc:plan_held_mail_discard", "remove", "rpc:finish_held_mail_discard"]);
    expect(s.removes).toEqual([["held/9/1-a.pdf"]]);
  });

  it("deletes nothing when the files can't be removed", async () => {
    const s = setup({ rpc: { plan_held_mail_discard: { data: { paths: ["held/9/1-a.pdf"] } } }, removeFails: true });
    const res = await handleHeldMailRequest(post({ action: "discard", message_id: 9 }), s.deps);
    expect(res.status).toBe(500);
    expect(s.order).not.toContain("rpc:finish_held_mail_discard");
  });

  it("logs ids and counts, never a path", async () => {
    const s = setup({ rpc: { plan_held_mail_discard: { data: { paths: ["held/9/1-secret-name.pdf"] } }, finish_held_mail_discard: { data: {} } } });
    await handleHeldMailRequest(post({ action: "discard", message_id: 9 }), s.deps);
    expect(s.logs.join("\n")).toContain("HELD_MAIL_DISCARDED message=9 by=admin files=1");
    expect(s.logs.join("\n")).not.toContain("secret-name");
  });
});

describe("held-mail: the schedule", () => {
  it("purges what is due, with no person named, and counts it", async () => {
    const s = setup({ rpc: { held_mail_due: { data: [{ message_id: 5 }, { message_id: 6 }] }, plan_held_mail_discard: { data: { paths: [] } }, finish_held_mail_discard: { data: {} } } });
    const res = await handleHeldMailRequest(post({ action: "purge" }, SERVICE), s.deps);
    expect(await res.json()).toEqual({ purged: 2, failed: 0 });
    expect(s.rpc.mock.calls[0]).toEqual(["held_mail_due", { p_limit: PURGE_BATCH }]);
    expect(s.rpc.mock.calls.filter(([fn]) => fn === "plan_held_mail_discard").map(([, a]) => a)).toEqual([
      { p_message_id: 5, p_actor: null }, { p_message_id: 6, p_actor: null },
    ]);
  });

  it("treats a call with no action from the schedule as a purge", async () => {
    const s = setup({ rpc: { held_mail_due: { data: [] } } });
    expect(await (await handleHeldMailRequest(post({}, SERVICE), s.deps)).json()).toEqual({ purged: 0, failed: 0 });
  });

  it("raises the deletion alert for a message it couldn't remove, and goes on", async () => {
    const s = setup({ rpc: { held_mail_due: { data: [{ message_id: 5 }, { message_id: 6 }] }, plan_held_mail_discard: (a) => (a.p_message_id === 5 ? { data: { paths: ["held/5/x"] } } : { data: { paths: [] } }), finish_held_mail_discard: { data: {} } }, removeFails: true });
    const res = await handleHeldMailRequest(post({ action: "purge" }, SERVICE), s.deps);
    expect(await res.json()).toEqual({ purged: 1, failed: 1 });
    expect(s.rpc.mock.calls.find(([fn]) => fn === "record_ops_event")![1]).toMatchObject({ p_kind: "deletion_failed", p_source: "held-mail", p_code: "held_mail:storage_remove" });
  });

  it("answers 500 when it can't read what is due", async () => {
    const s = setup({ rpc: { held_mail_due: { error: { code: "XX000" } } } });
    expect((await handleHeldMailRequest(post({ action: "purge" }, SERVICE), s.deps)).status).toBe(500);
  });
});
