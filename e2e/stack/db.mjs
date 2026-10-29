// The data plane of the e2e stack: a real PostgreSQL with the Supabase bootstrap and every migration.
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { DATABASE, PG } from "./config.mjs";

const BOOTSTRAP = new URL("./bootstrap.sql", import.meta.url);
const MIGRATIONS = new URL("../../supabase/migrations/", import.meta.url);

/** `e2e` must be in the name: the database is dropped, so it can never be one someone cares about. */
const SAFE_DATABASE = /^[a-z0-9_]*e2e[a-z0-9_]*$/;

const connectionHelp = `check PGHOST, PGPORT, PGUSER and PGPASSWORD (the user must be a superuser named "postgres")`;

function describePgError(error, sql) {
  let text = error.message;
  // `position` is a 1-based offset into the script, which is easier to find as a line number.
  if (error.position && sql) {
    const line = sql.slice(0, Number(error.position) - 1).split("\n").length;
    text += ` (line ${line})`;
  }
  if (error.detail) text += `\n  detail: ${error.detail}`;
  if (error.hint) text += `\n  hint: ${error.hint}`;
  if (error.where) text += `\n  where: ${error.where.replaceAll("\n", "\n         ")}`;
  return text;
}

async function connect(database) {
  const client = new pg.Client({ ...PG, database });
  // A dropped connection would otherwise surface as an uncaught 'error' event.
  client.on("error", () => {});
  try {
    await client.connect();
  } catch (error) {
    throw new Error(`Cannot connect to Postgres at ${PG.host}:${PG.port} as ${PG.user}: ${error.message || error.code}\n${connectionHelp}`);
  }
  return client;
}

async function runScript(client, name, sql, { transaction }) {
  try {
    if (transaction) await client.query("BEGIN");
    await client.query(sql);
    if (transaction) await client.query("COMMIT");
  } catch (error) {
    if (transaction) await client.query("ROLLBACK").catch(() => {});
    throw new Error(`${name} failed: ${describePgError(error, sql)}`);
  }
}

/**
 * Drops and recreates the e2e database, then applies the bootstrap and every migration in filename
 * order, each in its own transaction as `supabase db push` does. Throws naming the file that failed.
 */
export async function resetDatabase({ log = () => {} } = {}) {
  if (!SAFE_DATABASE.test(DATABASE)) {
    throw new Error(`Refusing to reset database "${DATABASE}": it is dropped, so its name must match ${SAFE_DATABASE}`);
  }
  const files = (await readdir(MIGRATIONS)).filter((name) => name.endsWith(".sql")).sort();

  const admin = await connect("postgres");
  try {
    // The bootstrap needs the real superuser, and a managed server (Supabase cloud's `postgres` can
    // create databases but is no superuser) must not get a stray database from a stale PGHOST.
    const { rows } = await admin.query("SELECT rolsuper FROM pg_roles WHERE rolname = current_user");
    if (PG.user !== "postgres" || !rows[0]?.rolsuper) {
      throw new Error(`${PG.user} at ${PG.host}:${PG.port} is not the superuser "postgres", so nothing was changed\n${connectionHelp}`);
    }
    try {
      // template0, so nothing installed in the server's template1 leaks in and the bootstrap sees an empty database.
      await admin.query(`DROP DATABASE IF EXISTS "${DATABASE}" WITH (FORCE)`);
      await admin.query(`CREATE DATABASE "${DATABASE}" TEMPLATE template0`);
    } catch (error) {
      throw new Error(`Cannot recreate database ${DATABASE} as ${PG.user}: ${error.message}\n${connectionHelp}`);
    }
  } finally {
    await admin.end();
  }

  const client = await connect(DATABASE);
  try {
    await runScript(client, "bootstrap.sql", await readFile(BOOTSTRAP, "utf8"), { transaction: false });
    for (const file of files) {
      await runScript(client, file, await readFile(new URL(file, MIGRATIONS), "utf8"), { transaction: true });
    }
  } finally {
    await client.end();
  }
  log(`database ${DATABASE} ready: bootstrap and ${files.length} migrations applied`);
}

/**
 * Connections are the PG superuser. Requests switch role per transaction (see withRequest), the way
 * PostgREST does, so row security and grants are enforced for the role being impersonated.
 */
export function createPool({ log = () => {} } = {}) {
  // UTC like Supabase, so timestamps in JSON do not depend on the machine's time zone.
  const pool = new pg.Pool({ ...PG, database: DATABASE, max: 10, options: "-c timezone=UTC" });
  pool.on("error", (error) => log(`idle database connection failed: ${error.message}`));
  return pool;
}

/**
 * Runs `fn(client)` in a transaction as the database role and JWT claims of one API request. Role and
 * claims are transaction-local, so a pooled connection can never carry them into the next request.
 */
export async function withRequest(pool, { role, claims, method }, fn) {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT set_config('role', $1, true),
              set_config('request.jwt.claims', $2, true),
              set_config('request.method', $3, true),
              set_config('search_path', 'public, extensions', true)`,
      [role, JSON.stringify(claims), method],
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {
      broken = true;
    });
    throw error;
  } finally {
    // A connection that cannot even roll back is discarded rather than returned to the pool.
    client.release(broken);
  }
}
