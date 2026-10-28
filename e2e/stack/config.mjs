// Settings shared by the e2e stack (gateway, database) and playwright.config.ts. Every value can be
// overridden by an environment variable so two runs, or a run and a local Supabase, don't collide.
import { signJwt } from "./jwt.mjs";

const num = (name, fallback) => Number(process.env[name] || fallback);

/** The Supabase stand-in (auth, REST, functions). */
export const GATEWAY_PORT = num("E2E_GATEWAY_PORT", 54399);
export const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`;

/** The app, served by `vite preview` from a production build. `localhost` is a secure context, which `crypto.randomUUID` needs. */
export const APP_PORT = num("E2E_APP_PORT", 4180);
export const APP_URL = `http://localhost:${APP_PORT}`;

/** Postgres: standard libpq variables, defaulting to the same server the CI `sql-tests` job uses. */
export const PG = {
  host: process.env.PGHOST || "localhost",
  port: num("PGPORT", 5432),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
};
/** Dropped and recreated on every gateway start. Never point this at a database you care about. */
export const DATABASE = process.env.E2E_DATABASE || "eaa_e2e";

/** Test-only signing secret. Tokens signed with it are worthless anywhere else. */
export const JWT_SECRET = "e2e-only-jwt-secret-for-the-local-supabase-stand-in";

// API keys in the shape Supabase issues: long-lived JWTs whose `role` claim picks the database role.
const KEY_EXPIRY = 4102444800; // 2100-01-01
export const ANON_KEY = signJwt({ iss: "eaa-e2e", role: "anon", iat: 1700000000, exp: KEY_EXPIRY }, JWT_SECRET);
export const SERVICE_ROLE_KEY = signJwt({ iss: "eaa-e2e", role: "service_role", iat: 1700000000, exp: KEY_EXPIRY }, JWT_SECRET);
