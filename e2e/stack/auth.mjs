// A subset of GoTrue (Supabase Auth), backed by the real auth.users table. The prospect path uses
// anonymous sign-in and the email-change OTP that turns a guest into a verified user. The advisor path
// uses email-and-password sign-up and sign-in and the multi-factor endpoints (an authenticator app, TOTP):
// a password sign-in's token is at assurance level aal1 and lists "password" in `amr`, and completing a
// second factor issues one at aal2 that lists "totp" too, which is what the database's second-factor
// rule reads. Token refresh is reached by advisor-second-factor.spec.ts; only POST /logout is reached by no
// spec (signOut is only called from the advisor's pages). An unknown endpoint answers 404 and an
// unsupported option on a known one 422, both with code e2e_unsupported, so a gap in this stand-in is
// obvious, not silent.
import { randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { GATEWAY_URL, JWT_SECRET } from "./config.mjs";
import { withRequest } from "./db.mjs";
import { signJwt, verifyJwt } from "./jwt.mjs";
import { newSecret, totpMatches } from "./totp.mjs";

const ACCESS_TOKEN_SECONDS = 3600;
const OTP_VALID_MINUTES = 60;
// GoTrue lets a just-used refresh token be presented again for a few seconds (tabs, retries).
const REFRESH_REUSE_MS = 10_000;
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const CHALLENGE_VALID_SECONDS = 300;

// GoTrue stores bcrypt hashes; only this stand-in ever reads the column, so scrypt will do.
function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 32).toString("hex")}`;
}
function passwordMatches(password, stored) {
  const [kind, salt, hash] = String(stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const got = scryptSync(password, Buffer.from(salt, "hex"), 32);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// An SVG standing in for the QR code. A real one encodes the otpauth URI; no spec scans it, it types the secret.
const placeholderQr = () =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="white"/><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/></svg>';

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

function userJson(row, factors = []) {
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
    factors: factors.map((f) => ({
      id: f.id,
      friendly_name: f.friendlyName,
      factor_type: "totp",
      status: f.status,
      created_at: f.createdAt,
      updated_at: f.createdAt,
    })),
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
  const refreshTokens = new Map(); // token -> { userId, sessionId, usedAt, amr, aal }
  // Authenticator apps by user id. Like the refresh tokens they need not outlive the process.
  const factorsByUser = new Map(); // userId -> [{ id, friendlyName, secret, status, createdAt, challenges: Map(id -> expiresAt) }]
  const factorsOf = (userId) => factorsByUser.get(userId) ?? [];
  const passwordAmr = () => ({ amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }] });
  const factorFor = (userId, id) => {
    const factor = factorsOf(userId).find((f) => f.id === id);
    if (!factor) throw new AuthError(404, "mfa_factor_not_found", "MFA factor not found", API_VERSION);
    return factor;
  };

  // GoTrue connects as supabase_auth_admin; its writes fire the same triggers (the profile row).
  const asAuthAdmin = (fn) => withRequest(pool, { role: "supabase_auth_admin", claims: {}, method: "POST" }, fn);

  async function findUser(id) {
    const { rows } = await asAuthAdmin((db) => db.query("SELECT * FROM auth.users WHERE id = $1", [id]));
    return rows[0] ?? null;
  }

  /** `amr` says how this sign-in began and which factors it has completed; `aal` is the assurance level that earns. */
  function issueSession(row, sessionId = randomUUID(), { amr, aal = "aal1" } = {}) {
    const now = Math.floor(Date.now() / 1000);
    amr ??= [{ method: row.is_anonymous ? "anonymous" : "otp", timestamp: now }];
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
        aal,
        amr,
        session_id: sessionId,
        is_anonymous: row.is_anonymous,
      },
      JWT_SECRET,
    );
    const refreshToken = randomBytes(8).toString("base64url");
    refreshTokens.set(refreshToken, { userId: row.id, sessionId, usedAt: null, amr, aal });
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_SECONDS,
      expires_at: expiresAt,
      refresh_token: refreshToken,
      user: userJson(row, factorsOf(row.id)),
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

  // signUp({ email, password }). There is no mailer here, so the address counts as confirmed at once, as it does
  // on a Supabase project with "Confirm email" off.
  async function signUpWithPassword(json) {
    if (!json.password) throw new AuthError(422, "e2e_unsupported", "The e2e auth stand-in only supports sign-up by email with a password");
    const email = String(json.email).trim().toLowerCase();
    const taken = await asAuthAdmin((db) => db.query("SELECT 1 FROM auth.users WHERE lower(email) = $1 AND NOT is_sso_user", [email]));
    if (taken.rowCount) throw new AuthError(422, "user_already_exists", "User already registered", API_VERSION);
    const metadata = json.data && typeof json.data === "object" ? json.data : {};
    const { rows } = await asAuthAdmin((db) =>
      db.query(
        `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, is_anonymous,
                                 raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at)
         VALUES ($1, $2, 'authenticated', 'authenticated', $3, $4, now(), false,
                 '{"provider":"email","providers":["email"]}', $5, now(), now(), now())
         RETURNING *`,
        [ZERO_UUID, randomUUID(), email, hashPassword(String(json.password)), JSON.stringify(metadata)],
      ),
    );
    return { body: issueSession(rows[0], randomUUID(), passwordAmr()) };
  }

  const routes = {
    // signInAnonymously(): the row in auth.users is what AI quota, documents and the outbox's
    // email lookup depend on, so it is written here exactly as GoTrue would.
    async "POST /signup"(req, json) {
      if (json.phone) throw new AuthError(422, "e2e_unsupported", "The e2e auth stand-in does not support phone sign-up");
      if (json.email) return signUpWithPassword(json);
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
      if (!json.email) return { body: userJson(row, factorsOf(row.id)) };

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
      return { body: userJson(rows[0], factorsOf(row.id)) };
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
      return { body: userJson(row, factorsOf(row.id)) };
    },

    async "POST /token"(req, json, url) {
      const grant = url.searchParams.get("grant_type");
      // signInWithPassword(): the token is at aal1 and says the sign-in used a password.
      if (grant === "password") {
        const { rows } = await asAuthAdmin((db) => db.query("SELECT * FROM auth.users WHERE lower(email) = $1 AND NOT is_sso_user", [String(json.email ?? "").trim().toLowerCase()]));
        const row = rows[0];
        if (!row || !passwordMatches(String(json.password ?? ""), row.encrypted_password)) {
          throw new AuthError(400, "invalid_credentials", "Invalid login credentials", API_VERSION);
        }
        await asAuthAdmin((db) => db.query("UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1", [row.id]));
        return { body: issueSession(row, randomUUID(), passwordAmr()) };
      }
      if (grant !== "refresh_token") {
        throw new AuthError(422, "e2e_unsupported", `The e2e auth stand-in only supports grant_type=password and refresh_token (got ${grant})`);
      }
      const entry = refreshTokens.get(json.refresh_token);
      const stale = entry?.usedAt && Date.now() - entry.usedAt > REFRESH_REUSE_MS;
      const row = entry && !stale ? await findUser(entry.userId) : null;
      if (!row) throw new AuthError(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      entry.usedAt ??= Date.now();
      // A refreshed session keeps its level: a second factor completed in it stays completed.
      return { body: issueSession(row, entry.sessionId, { amr: entry.amr, aal: entry.aal }) };
    },

    // mfa.enroll({ factorType: "totp" }): the factor is unverified until a code from it is verified.
    async "POST /factors"(req, json) {
      const { row } = await userFromBearer(req);
      if (json.factor_type !== "totp") throw new AuthError(422, "e2e_unsupported", `The e2e auth stand-in only enrols totp factors (got ${json.factor_type})`);
      const friendlyName = json.friendly_name ? String(json.friendly_name) : "";
      const mine = factorsOf(row.id);
      if (friendlyName && mine.some((f) => f.friendlyName === friendlyName)) {
        throw new AuthError(422, "mfa_factor_name_conflict", `A factor with the friendly name "${friendlyName}" for this user already exists`, API_VERSION);
      }
      const factor = { id: randomUUID(), friendlyName, secret: newSecret(), status: "unverified", createdAt: new Date().toISOString(), challenges: new Map() };
      factorsByUser.set(row.id, [...mine, factor]);
      const uri = `otpauth://totp/Nevermore:${encodeURIComponent(row.email ?? "")}?secret=${factor.secret}&issuer=Nevermore`;
      return { body: { id: factor.id, type: "totp", friendly_name: friendlyName, totp: { qr_code: placeholderQr(), secret: factor.secret, uri } } };
    },

    // mfa.unenroll(): GoTrue lets a verified factor go only from a session that has completed one.
    async "DELETE /factors/:id"(req, json, url, [factorId]) {
      const { row, claims } = await userFromBearer(req);
      const factor = factorFor(row.id, factorId);
      if (factor.status === "verified" && claims.aal !== "aal2") throw new AuthError(422, "insufficient_aal", "AAL2 required to unenroll a verified factor", API_VERSION);
      factorsByUser.set(row.id, factorsOf(row.id).filter((f) => f.id !== factorId));
      return { body: { id: factorId } };
    },

    // mfa.challenge()
    async "POST /factors/:id/challenge"(req, json, url, [factorId]) {
      const { row } = await userFromBearer(req);
      const factor = factorFor(row.id, factorId);
      const id = randomUUID();
      const expiresAt = Math.floor(Date.now() / 1000) + CHALLENGE_VALID_SECONDS;
      factor.challenges.set(id, expiresAt);
      return { body: { id, type: "totp", expires_at: expiresAt } };
    },

    // mfa.verify(): a right code verifies the factor and answers with a new token at aal2 for the same session.
    async "POST /factors/:id/verify"(req, json, url, [factorId]) {
      const { row, claims } = await userFromBearer(req);
      const factor = factorFor(row.id, factorId);
      const expiresAt = factor.challenges.get(json.challenge_id);
      if (!expiresAt) throw new AuthError(404, "mfa_factor_not_found", "MFA challenge not found", API_VERSION);
      if (expiresAt * 1000 < Date.now()) throw new AuthError(422, "mfa_challenge_expired", "MFA challenge has expired, verify against another challenge or create a new challenge.", API_VERSION);
      factor.challenges.delete(json.challenge_id);
      if (!totpMatches(factor.secret, json.code)) throw new AuthError(400, "mfa_verification_failed", "Invalid TOTP code entered", API_VERSION);
      factor.status = "verified";
      const now = Math.floor(Date.now() / 1000);
      const amr = [{ method: "totp", timestamp: now }, ...(Array.isArray(claims.amr) ? claims.amr : [])];
      return { body: issueSession(row, claims.session_id, { amr, aal: "aal2" }) };
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
      // ":id" in a route's path stands for one path segment; the segments reach the route as its last argument.
      let route = routes[`${req.method} ${path}`];
      let params = [];
      if (!route) {
        for (const [key, candidate] of Object.entries(routes)) {
          const [method, pattern] = key.split(" ");
          const match = method === req.method && pattern.includes(":") ? new RegExp(`^${pattern.replace(/:[a-z]+/g, "([^/]+)")}$`).exec(path) : null;
          if (match) {
            route = candidate;
            params = match.slice(1);
            break;
          }
        }
      }
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
        const result = await route(req, json ?? {}, url, params);
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
