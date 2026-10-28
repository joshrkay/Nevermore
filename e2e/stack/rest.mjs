// The slice of PostgREST the prospect path uses. Every request runs in a transaction as the database
// role and JWT claims of its token (see withRequest), so row security, grants and triggers are the real
// ones. Query features beyond that slice answer 400 E2E_UNSUPPORTED rather than being guessed at.
import pg from "pg";
import { JWT_SECRET } from "./config.mjs";
import { withRequest } from "./db.mjs";
import { verifyJwt } from "./jwt.mjs";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const API_ROLES = new Set(["anon", "authenticated", "service_role"]);
const OBJECT_ACCEPT = "application/vnd.pgrst.object+json";
const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset", "columns"]);
const COMPARISONS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };
const ORDER_MODIFIERS = { asc: "ASC", desc: "DESC", nullsfirst: "NULLS FIRST", nullslast: "NULLS LAST" };

class RestError extends Error {
  constructor(status, code, message, { details = null, hint = null } = {}) {
    super(message);
    this.status = status;
    this.body = { code, message, details, hint };
  }
}

const tableNotFound = (table) => new RestError(404, "PGRST205", `Could not find the table 'public.${table}' in the schema cache`);
const unsupported = (what) => new RestError(400, "E2E_UNSUPPORTED", `The e2e PostgREST stand-in does not support ${what}`);
const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** Identifiers are interpolated into SQL, so only plain names pass; aliases, casts and JSON paths are the gap. */
function quote(name, what) {
  if (!IDENTIFIER.test(name)) throw unsupported(`${what} "${name}" (only plain column names)`);
  return `"${name}"`;
}

function statusForSqlState(code, role) {
  if (code === "42501") return role === "anon" ? 401 : 403;
  if (code === "23503" || code === "23505") return 409;
  if (code === "42883" || code === "42P01") return 404;
  if (/^(0L|0P|28)/.test(code)) return 403;
  if (/^(08|09|25|2D|38|39|3B|40|53|54|55|57|58|F0|HV|XX)/.test(code) || (code.startsWith("P0") && code !== "P0001")) return 500;
  return 400;
}

/** Bearer token (or, like Supabase's gateway, the apikey when there is none) -> database role and claims. */
function authenticate(req) {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization ?? "")?.[1] ?? req.headers.apikey;
  if (!token) return { role: "anon", claims: { role: "anon" } };
  const claims = verifyJwt(token, JWT_SECRET);
  if (!claims) throw new RestError(401, "PGRST301", "JWT invalid or expired");
  const role = claims.role ?? "anon";
  if (!API_ROLES.has(role)) throw new RestError(401, "PGRST301", `JWT role "${role}" is not one of ${[...API_ROLES].join(", ")}`);
  return { role, claims };
}

function parsePrefer(header) {
  const prefer = {};
  for (const part of String(header ?? "").split(",")) {
    const [key, value] = part.trim().split("=");
    if (key) prefer[key] = value ?? true;
  }
  if (prefer.count) throw unsupported("Prefer: count");
  if (prefer.resolution) throw unsupported("upserts (Prefer: resolution)");
  return prefer;
}

function parseSelect(url) {
  const list = (url.searchParams.get("select") || "*").split(",").map((column) => column.trim());
  return list.map((column) => (column === "*" ? "*" : quote(column, "select column"))).join(", ");
}

/** `in.(a,b,"c,d")` -> ["a", "b", "c,d"]. */
function parseList(operand) {
  if (!operand.startsWith("(") || !operand.endsWith(")")) throw new RestError(400, "PGRST100", `Invalid list "${operand}": expected in.(a,b)`);
  const inner = operand.slice(1, -1);
  if (!inner) return [];
  const items = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (quoted && char === "\\") current += inner[++i];
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      items.push(current);
      current = "";
    } else current += char;
  }
  items.push(current);
  return items;
}

/** Filters become a WHERE clause; values are always parameters, never SQL text. */
function parseFilters(url, param) {
  const clauses = [];
  for (const [key, value] of url.searchParams) {
    if (RESERVED_PARAMS.has(key)) continue;
    if (key === "and" || key === "or" || key === "not") throw unsupported(`the "${key}" filter`);
    const column = quote(key, "filter column");
    const dot = value.indexOf(".");
    const operator = value.slice(0, dot < 0 ? undefined : dot);
    const operand = dot < 0 ? "" : value.slice(dot + 1);
    if (Object.hasOwn(COMPARISONS, operator)) {
      clauses.push(`${column} ${COMPARISONS[operator]} ${param(operand)}`);
    } else if (operator === "is") {
      const literal = { null: "NULL", true: "TRUE", false: "FALSE" }[operand];
      if (!literal) throw new RestError(400, "PGRST100", `Filter "is" takes null, true or false (got "${operand}")`);
      clauses.push(`${column} IS ${literal}`);
    } else if (operator === "in") {
      clauses.push(`${column} = ANY(${param(parseList(operand))})`);
    } else {
      throw unsupported(`the filter operator "${operator}"`);
    }
  }
  return clauses;
}

function parseOrder(url) {
  const order = url.searchParams.get("order");
  if (!order) return "";
  const terms = order.split(",").map((term) => {
    const [column, ...modifiers] = term.split(".");
    const sql = modifiers.map((modifier) => {
      if (!Object.hasOwn(ORDER_MODIFIERS, modifier)) throw unsupported(`the order modifier "${modifier}"`);
      return ORDER_MODIFIERS[modifier];
    });
    return [quote(column, "order column"), ...sql].join(" ");
  });
  return ` ORDER BY ${terms.join(", ")}`;
}

function parsePaging(url, param) {
  let sql = "";
  for (const key of ["limit", "offset"]) {
    const value = url.searchParams.get(key);
    if (value === null) continue;
    if (!/^\d+$/.test(value)) throw new RestError(400, "PGRST100", `"${key}" must be a non-negative integer (got "${value}")`);
    sql += ` ${key.toUpperCase()} ${param(value)}`;
  }
  return sql;
}

/** One row set as SQL: the row count, the JSON array, and the first row as an object. */
const aggregate = (rows) => `SELECT count(*)::int AS n,
       coalesce(json_agg(r), '[]'::json)::text AS body,
       (array_agg(to_json(r)))[1]::text AS first
  FROM ${rows} r`;

const rowCountError = (n) =>
  new RestError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", { details: `The result contains ${n} rows` });

function parseBody(body, { allowEmpty = false } = {}) {
  if (!body.length) {
    if (allowEmpty) return {};
    throw new RestError(400, "PGRST102", "Empty or invalid json");
  }
  try {
    return JSON.parse(body.toString("utf8"));
  } catch (error) {
    throw new RestError(400, "PGRST102", "Empty or invalid json", { details: error.message });
  }
}

function rowsResponse(result, { status, wantsObject, range }) {
  if (wantsObject && result.n !== 1) throw rowCountError(result.n);
  return {
    status,
    headers: { "Content-Type": `${wantsObject ? OBJECT_ACCEPT : "application/json"}; charset=utf-8`, "Content-Range": range },
    rawBody: wantsObject ? result.first : result.body,
  };
}

const contentRange = (n, offset = 0) => (n ? `${offset}-${offset + n - 1}/*` : "*/*");

/** @returns {{ handle: (req, url, body: Buffer) => Promise<{status:number, headers?:object, body?:unknown, rawBody?:string}> }} */
export function createRest({ pool, log = () => {} }) {
  async function readTable(ctx, url, table, wantsObject) {
    const values = [];
    const param = (value) => (values.push(value), `$${values.length}`);
    const where = parseFilters(url, param);
    const sql = `SELECT ${parseSelect(url)} FROM public.${quote(table, "table")}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}${parseOrder(url)}${parsePaging(url, param)}`;
    const offset = Number(url.searchParams.get("offset") ?? 0);
    return withRequest(pool, ctx, async (db) => {
      const { rows } = await db.query(aggregate(`(${sql})`), values);
      return rowsResponse(rows[0], { status: 200, wantsObject, range: contentRange(rows[0].n, offset) });
    });
  }

  async function writeTable(ctx, req, url, table, body, prefer, wantsObject) {
    const method = req.method;
    for (const key of ["order", "limit", "offset"]) {
      if (method !== "POST" && url.searchParams.has(key)) throw unsupported(`"${key}" on ${method}`);
    }
    const values = [];
    const param = (value) => (values.push(value), `$${values.length}`);
    const target = `public.${quote(table, "table")}`;
    const returning = parseSelect(url);
    const representation = prefer.return === "representation";
    let statement;

    if (method === "POST") {
      const payload = parseBody(body);
      const objects = Array.isArray(payload) ? payload : [payload];
      if (!objects.every(isPlainObject)) throw new RestError(400, "PGRST102", "Payload must be a JSON object or an array of objects");
      const columns = [...new Set(objects.flatMap(Object.keys))].map((key) => quote(key, "column"));
      if (!columns.length) throw unsupported("an insert with no columns");
      // Only the keys present are inserted, so column defaults (id, status, created_at) still apply.
      statement = `INSERT INTO ${target} (${columns.join(", ")})
                   SELECT ${columns.join(", ")} FROM json_populate_recordset(null::${target}, ${param(JSON.stringify(objects))}::json)`;
    } else if (method === "PATCH" || method === "DELETE") {
      let assignment = "";
      if (method === "PATCH") {
        const payload = parseBody(body);
        if (!isPlainObject(payload)) throw new RestError(400, "PGRST102", "PATCH body must be a JSON object");
        const columns = Object.keys(payload).map((key) => quote(key, "column"));
        if (!columns.length) return { status: representation ? 200 : 204, headers: { "Content-Range": "*/*" }, rawBody: representation ? "[]" : undefined };
        assignment = ` SET (${columns.join(", ")}) = (SELECT ${columns.join(", ")} FROM json_populate_record(null::${target}, ${param(JSON.stringify(payload))}::json))`;
      }
      const where = parseFilters(url, param);
      // What Supabase's pg-safeupdate does: a write that forgot its filter would touch every row.
      if (!where.length) throw new RestError(400, "21000", `${method === "PATCH" ? "UPDATE" : "DELETE"} requires a WHERE clause`);
      const verb = method === "PATCH" ? `UPDATE ${target}${assignment}` : `DELETE FROM ${target}`;
      statement = `${verb} WHERE ${where.join(" AND ")}`;
    } else {
      throw new RestError(405, "PGRST117", `Unsupported HTTP method: ${method}`);
    }

    const okStatus = method === "POST" ? 201 : 200;
    return withRequest(pool, ctx, async (db) => {
      if (!representation) {
        await db.query(statement, values);
        return { status: method === "POST" ? 201 : 204, headers: { "Content-Range": "*/*" } };
      }
      const { rows } = await db.query(`WITH changed AS (${statement} RETURNING ${returning}) ${aggregate("changed")}`, values);
      // Thrown inside the transaction, so a write that cannot be returned as one object is undone.
      return rowsResponse(rows[0], { status: okStatus, wantsObject, range: contentRange(rows[0].n) });
    });
  }

  async function callFunction(ctx, req, name, body) {
    if (req.method !== "POST") throw unsupported(`${req.method} on rpc (only POST)`);
    const args = parseBody(body, { allowEmpty: true });
    if (!isPlainObject(args)) throw unsupported("positional or single-object rpc arguments");
    const keys = Object.keys(args);

    return withRequest(pool, ctx, async (db) => {
      const { rows: candidates } = await db.query(
        `SELECT p.proargnames, p.proargmodes::text[] AS proargmodes, p.pronargs, p.pronargdefaults, p.proretset,
                p.prorettype::regtype::text AS rettype,
                (SELECT array_agg(format_type(a, NULL) ORDER BY o) FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY u(a, o)) AS argtypes
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1 AND p.prokind = 'f'`,
        [name],
      );
      // PostgREST matches on parameter names: every key must name an argument and every required one must be present.
      const match = candidates
        .map((candidate) => ({ ...candidate, names: (candidate.proargnames ?? []).filter((_, i) => !candidate.proargmodes || "ibv".includes(candidate.proargmodes[i])) }))
        .find(({ names, pronargs, pronargdefaults }) => keys.every((key) => names.includes(key)) && names.slice(0, pronargs - pronargdefaults).every((n) => keys.includes(n)));
      if (!match) {
        throw new RestError(404, "PGRST202", `Could not find the function public.${name}(${keys.join(", ")}) in the schema cache`, {
          hint: candidates.length ? "A function with that name exists, but not with those parameter names." : null,
        });
      }

      const values = [];
      const call = keys
        .map((key) => {
          const type = match.argtypes[match.names.indexOf(key)];
          const value = args[key];
          // jsonb arguments take their JSON text; arrays pass through and node-postgres writes the array literal.
          const bound = /^jsonb?$/.test(type) ? (value === null ? null : JSON.stringify(value)) : isPlainObject(value) ? JSON.stringify(value) : value;
          values.push(bound);
          return `${quote(key, "argument")} => $${values.length}::${type}`;
        })
        .join(", ");
      const fn = `public.${quote(name, "function")}(${call})`;

      if (match.rettype === "void") {
        await db.query(`SELECT ${fn}`, values);
        return { status: 204 };
      }
      if (match.proretset) {
        const { rows } = await db.query(aggregate(fn), values);
        return { status: 200, headers: { "Content-Range": contentRange(rows[0].n) }, rawBody: rows[0].body };
      }
      // A scalar (or composite) result is the bare JSON value, e.g. `true`, `"submitted"` or `null`.
      const { rows } = await db.query(`SELECT to_json(${fn})::text AS body`, values);
      return { status: 200, rawBody: rows[0].body ?? "null" };
    });
  }

  return {
    /** Answers one request under /rest/v1. */
    async handle(req, url, body) {
      let role = "anon";
      let table = null;
      try {
        const ctx = authenticate(req);
        role = ctx.role;
        const target = url.pathname.replace(/^\/rest\/v1\/?/, "");
        if (!target) throw unsupported("the OpenAPI document at /rest/v1/");
        if (target.split("/").length > (target.startsWith("rpc/") ? 2 : 1)) throw new RestError(404, "PGRST125", "Invalid path specified in request URL");

        const reading = req.method === "GET" || req.method === "HEAD";
        const profile = req.headers[reading ? "accept-profile" : "content-profile"];
        if (profile && profile !== "public") throw new RestError(406, "PGRST106", `The schema must be one of the following: public (got ${profile})`);
        if (req.method === "HEAD") throw unsupported("HEAD requests");

        const prefer = parsePrefer(req.headers.prefer);
        const wantsObject = String(req.headers.accept ?? "").includes(OBJECT_ACCEPT);
        const request = { role: ctx.role, claims: ctx.claims, method: req.method };

        if (target.startsWith("rpc/")) return await callFunction(request, req, target.slice(4), body);

        if (!IDENTIFIER.test(target)) throw tableNotFound(target);
        table = target;
        if (req.method === "GET") return await readTable(request, url, target, wantsObject);
        return await writeTable(request, req, url, target, body, prefer, wantsObject);
      } catch (error) {
        if (error instanceof RestError) {
          if (error.body.code === "E2E_UNSUPPORTED") log(`rest: ${error.message}`);
          return { status: error.status, body: error.body };
        }
        if (error instanceof pg.DatabaseError) {
          if (error.code === "42P01" && table && error.message.includes(table)) {
            const missing = tableNotFound(table);
            return { status: missing.status, body: missing.body };
          }
          const status = statusForSqlState(error.code, role);
          if (status >= 500) log(`rest: ${req.method} ${url.pathname} failed: ${error.message}`);
          return { status, body: { code: error.code, message: error.message, details: error.detail ?? null, hint: error.hint ?? null } };
        }
        log(`rest: ${req.method} ${url.pathname} failed: ${error.stack ?? error}`);
        return { status: 500, body: { code: "E2E_INTERNAL", message: error.message, details: null, hint: null } };
      }
    },
  };
}
