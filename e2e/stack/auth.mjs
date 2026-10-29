// A subset of GoTrue (Supabase Auth), backed by the real auth.users table. The prospect path uses
// anonymous sign-in and the email-change OTP that turns a guest into a verified user. Token refresh
// and POST /logout are implemented too, but no spec reaches them: tokens last an hour and signOut is
// only called from the advisor's pages. An unknown endpoint answers 404 and an unsupported option on a
// known one 422, both with code e2e_unsupported, so a gap in this stand-in is obvious, not silent.
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { GATEWAY_URL, JWT_SECRET } from "./config.mjs";
import { withRequest } from "./db.mjs";
import { signJwt, verifyJwt } from "./jwt.mjs";

const ACCESS_TOKEN_SECONDS = 3600;
const OTP_VALID_MINUTES = 60;
// GoTrue lets a just-used refresh token be presented again for a few seconds (tabs, retries).
const REFRESH_REUSE_MS = 10_000;
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

class AuthError extends Error {
  constructor(status, code, msg, headers = {}) {
    super(msg);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

const API_VERSION = { "X-Supabase-Api-Version": "2024-01-01" };

const iso = (value) => (value ? new Date(value).toISOString() : null);

function userJson(row) {
  const user = {
    id: row.id,
    aud: row.aud,
    role: row.role,
    email: row.email ?? "",
    phone: "",
    is_anonymous: row.is_anonymous,
    email_confirmed_at: iso(row.email_confirmed_at),
    confirmed_at: iso(row.confirmed_at),
    app_metadata: row.raw_app_meta_data ?? {},
    user_metadata: row.raw_user_meta_data ?? {},
    identities: [],
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    last_sign_in_at: iso(row.last_sign_in_at),
  };
  // GoTrue keeps the current address until the change is confirmed and reports the pending one here.
  if (row.email_change) {
    user.new_email = row.email_change;
    user.email_change_sent_at = iso(row.email_change_sent_at);
  }
  return user;
}

/** @returns {{ handle: (req, url, body: Buffer) => Promise<{status:number, headers?:object, body?:unknown}>, pendingCode: (email: string) => Promise<string|null> }} */
export function createAuth({ pool, log = () => {} }) {
  // The database is rebuilt on every gateway start, so sessions need not outlive the process.
  const refreshTokens = new Map(); // token -> { userId, sessionId, usedAt }

  // GoTrue connects as supabase_auth_admin; its writes fire the same triggers (the profile row).
  const asAuthAdmin = (fn) => withRequest(pool, { role: "supabase_auth_admin", claims: {}, method: "POST" }, fn);

  async function findUser(id) {
    const { rows } = await asAuthAdmin((db) => db.query("SELECT * FROM auth.users WHERE id = $1", [id]));
    return rows[0] ?? null;
  }

  function issueSession(row, sessionId = randomUUID()) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + ACCESS_TOKEN_SECONDS;
    const accessToken = signJwt(
      {
        iss: `${GATEWAY_URL}/auth/v1`,
        aud: "authenticated",
        exp: expiresAt,
        iat: now,
        sub: row.id,
        email: row.email ?? "",
        phone: "",
        app_metadata: row.raw_app_meta_data ?? {},
        user_metadata: row.raw_user_meta_data ?? {},
        role: "authenticated",
        aal: "aal1",
        session_id: sessionId,
        is_anonymous: row.is_anonymous,
      },
      JWT_SECRET,
    );
    const refreshToken = randomBytes(8).toString("base64url");
    refreshTokens.set(refreshToken, { userId: row.id, sessionId, usedAt: null });
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_SECONDS,
      expires_at: expiresAt,
      refresh_token: refreshToken,
      user: userJson(row),
    };
  }

  /** The user behind a bearer access token; throws the GoTrue error a bad or unknown token earns. */
  async function userFromBearer(req) {
    const token = /^Bearer (.+)$/i.exec(req.headers.authorization ?? "")?.[1];
    const claims = verifyJwt(token, JWT_SECRET);
    if (!claims) throw new AuthError(401, "bad_jwt", "invalid JWT: unable to parse or verify signature, token is malformed, has expired or is signed with another secret");
    if (!claims.sub) throw new AuthError(403, "bad_jwt", "invalid claim: missing sub claim");
    const row = await findUser(claims.sub);
    if (!row) throw new AuthError(403, "user_not_found", "User from sub claim in JWT does not exist");
    return { row, claims };
  }

  const routes = {
    // signInAnonymously(): the row in auth.users is what AI quota, documents and the outbox's
    // email lookup depend on, so it is written here exactly as GoTrue would.
    async "POST /signup"(req, json) {
      if (json.email || json.phone) throw new AuthError(422, "e2e_unsupported", "The e2e auth stand-in only supports anonymous sign-up");
      const id = randomUUID();
      const metadata = json.data && typeof json.data === "object" ? json.data : {};
      const { rows } = await asAuthAdmin((db) =>
        db.query(
          `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, is_anonymous,
                                   raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at)
           VALUES ($1, $2, 'authenticated', 'authenticated', NULL, '', true,
                   '{"provider":"anonymous","providers":["anonymous"]}', $3, now(), now(), now())
           RETURNING *`,
          [ZERO_UUID, id, JSON.stringify(metadata)],
        ),
      );
      return { body: issueSession(rows[0]) };
    },

    // updateUser({ email }): the address is only pending until /verify, so the user stays anonymous.
    async "PUT /user"(req, json) {
      const { row } = await userFromBearer(req);
      const unsupported = Object.entries(json).filter(([key, value]) => value != null && !["email", "code_challenge", "code_challenge_method"].includes(key));
      if (unsupported.length) throw new AuthError(422, "e2e_unsupported", `The e2e auth stand-in cannot update ${unsupported.map(([key]) => key).join(", ")}`);
      if (!json.email) return { body: userJson(row) };

      const email = String(json.email).trim().toLowerCase();
      const taken = await asAuthAdmin((db) => db.query("SELECT 1 FROM auth.users WHERE lower(email) = $1 AND id <> $2 AND NOT is_sso_user", [email, row.id]));
      if (taken.rowCount) throw new AuthError(422, "email_exists", "A user with this email address has already been registered", API_VERSION);

      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const { rows } = await asAuthAdmin((db) =>
        db.query(
          `UPDATE auth.users
              SET email_change = $2, email_change_token_new = $3, email_change_sent_at = now(),
                  email_change_confirm_status = 0, updated_at = now()
            WHERE id = $1
        RETURNING *`,
          [row.id, email, code],
        ),
      );
      log(`auth: email change for ${row.id} pending, code available at /__e2e/otp`);
      return { body: userJson(rows[0]) };
    },

    // verifyOtp({ type: "email_change" }): carries only the anon key as bearer, so the user is found by
    // the pending address and its code. The new token must say is_anonymous:false, because the database
    // refuses to certify an intake for a guest token.
    async "POST /verify"(req, json) {
      if (json.type !== "email_change" || !json.email || !json.token) {
        throw new AuthError(422, "e2e_unsupported", `The e2e auth stand-in only verifies type "email_change" with an email and token (got ${json.type})`);
      }
      const email = String(json.email).trim().toLowerCase();
      const row = await asAuthAdmin(async (db) => {
        const found = await db.query(
          `SELECT id FROM auth.users
            WHERE lower(email_change) = $1 AND email_change_token_new = $2
              AND email_change_sent_at > now() - make_interval(mins => $3)
            FOR UPDATE`,
          [email, String(json.token), OTP_VALID_MINUTES],
        );
        if (!found.rowCount) return null;
        try {
          const { rows } = await db.query(
            `UPDATE auth.users
                SET email = email_change, email_confirmed_at = COALESCE(email_confirmed_at, now()), is_anonymous = false,
                    email_change = '', email_change_token_new = '', email_change_token_current = '',
                    email_change_confirm_status = 0, email_change_sent_at = NULL,
                    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}') || '{"provider":"email","providers":["email"]}',
                    last_sign_in_at = now(), updated_at = now()
              WHERE id = $1
          RETURNING *`,
            [found.rows[0].id],
          );
          return rows[0];
        } catch (error) {
          // Another account confirmed the same address after this code was issued.
          if (error.code === "23505") throw new AuthError(422, "email_exists", "A user with this email address has already been registered", API_VERSION);
          throw error;
        }
      });
      if (!row) throw new AuthError(403, "otp_expired", "Token has expired or is invalid");
      return { body: issueSession(row) };
    },

    // Called server-side by chamber-extract to find out who is asking.
    async "GET /user"(req) {
      const { row } = await userFromBearer(req);
      return { body: userJson(row) };
    },

    async "POST /token"(req, json, url) {
      if (url.searchParams.get("grant_type") !== "refresh_token") {
        throw new AuthError(422, "e2e_unsupported", `The e2e auth stand-in only supports grant_type=refresh_token (got ${url.searchParams.get("grant_type")})`);
      }
      const entry = refreshTokens.get(json.refresh_token);
      const stale = entry?.usedAt && Date.now() - entry.usedAt > REFRESH_REUSE_MS;
      const row = entry && !stale ? await findUser(entry.userId) : null;
      if (!row) throw new AuthError(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      entry.usedAt ??= Date.now();
      return { body: issueSession(row, entry.sessionId) };
    },

    async "POST /logout"(req, json, url) {
      const { claims } = await userFromBearer(req);
      const scope = url.searchParams.get("scope") ?? "global";
      for (const [token, entry] of refreshTokens) {
        const sameUser = entry.userId === claims.sub;
        const sameSession = entry.sessionId === claims.session_id;
        if ((scope === "global" && sameUser) || (scope === "local" && sameSession) || (scope === "others" && sameUser && !sameSession)) {
          refreshTokens.delete(token);
        }
      }
      return { status: 204 };
    },
  };

  return {
    /** Answers one request under /auth/v1. */
    async handle(req, url, body) {
      const path = url.pathname.replace(/^\/auth\/v1/, "");
      const route = routes[`${req.method} ${path}`];
      try {
        if (!route) throw new AuthError(404, "e2e_unsupported", `The e2e auth stand-in does not implement ${req.method} ${url.pathname}`);
        let json = {};
        if (body.length) {
          try {
            json = JSON.parse(body.toString("utf8"));
          } catch {
            throw new AuthError(400, "bad_json", "Could not parse request body as JSON");
          }
        }
        const result = await route(req, json ?? {}, url);
        return { status: 200, ...result, headers: { ...API_VERSION, ...result.headers } };
      } catch (error) {
        if (!(error instanceof AuthError)) {
          log(`auth: ${req.method} ${url.pathname} failed: ${error.stack ?? error}`);
          // 5xx makes auth-js treat the failure as retryable instead of signing the user out.
          return { status: 500, headers: API_VERSION, body: { code: "unexpected_failure", msg: error.message } };
        }
        if (error.code === "e2e_unsupported") log(`auth: ${error.message}`);
        return { status: error.status, headers: { ...API_VERSION, ...error.headers }, body: { code: error.code, msg: error.message } };
      }
    },

    /** The code of the latest pending email change for this address, for the test to type into the app. */
    async pendingCode(email) {
      const { rows } = await asAuthAdmin((db) =>
        db.query(
          `SELECT email_change_token_new FROM auth.users
            WHERE lower(email_change) = $1 AND email_change_token_new <> ''
            ORDER BY email_change_sent_at DESC LIMIT 1`,
          [String(email).trim().toLowerCase()],
        ),
      );
      return rows[0]?.email_change_token_new ?? null;
    },
  };
}
