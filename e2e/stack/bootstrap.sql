-- A Supabase-shaped bootstrap for stock PostgreSQL 16, so every file in supabase/migrations applies
-- unmodified and then behaves like production for the prospect path. db.mjs runs it as one
-- simple-query script on a fresh, empty database, as the superuser `postgres`, before the
-- migrations: Supabase runs migrations as `postgres`, and the default privileges below are
-- registered FOR ROLE postgres, so another applying role would not hand out Supabase's grants.
--
-- Mirrored from Supabase (its postgres image, GoTrue and storage-api migrations). What the migrations
-- and the stand-in depend on:
--   * Roles: anon / authenticated (NOLOGIN NOINHERIT), service_role (NOLOGIN NOINHERIT BYPASSRLS),
--     supabase_auth_admin (owns schema auth) and supabase_storage_admin (owns storage), both NOLOGIN:
--     requests switch role from the superuser connection, so nothing logs in as any of them.
--   * Default privileges in public: everything postgres creates goes to the API roles. The
--     migrations rely on that and REVOKE what they close; row security does the rest.
--   * auth.users with GoTrue's columns, types and defaults (is_anonymous, email, email_confirmed_at,
--     raw_*_meta_data, generated confirmed_at). id, aud, role, created_at and updated_at have no
--     defaults, as in GoTrue: the gateway sets them.
--   * auth.uid() / auth.jwt(), reading the request.jwt.claims setting. The API roles can call them
--     but never read auth.users.
--   * storage.buckets / storage.objects with row security on, and storage.foldername.
-- Kept for parity with Supabase although nothing here uses them: auth.identities, auth.sessions,
-- auth.refresh_tokens, auth.aal_level, auth.role(), auth.email(), storage.filename and
-- storage.extension.
-- Not stubbed because no migration needs them: pg_cron, pg_net, vault, pgsodium, realtime.

SET client_min_messages = warning;

DO $$
BEGIN
  IF current_user <> 'postgres' OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'bootstrap.sql must run as the superuser "postgres" (it is %)', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('auth', 'storage'))
     OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public') THEN
    RAISE EXCEPTION 'bootstrap.sql expects a fresh, empty database';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Roles (cluster-wide). Idempotent, and tolerant of another session creating them at the same
--    time. Attributes are corrected only when they differ, to avoid needless catalog updates.
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  spec record;
  r pg_roles;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('anon',                   false, false, false, false),
      ('authenticated',          false, false, false, false),
      ('service_role',           false, false, true,  false),
      ('supabase_auth_admin',    false, false, false, true),
      ('supabase_storage_admin', false, false, false, true)
    ) AS t(name, can_login, inherit, bypassrls, createrole)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = spec.name) THEN
      BEGIN
        EXECUTE format('CREATE ROLE %I', spec.name);
      EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;  -- created concurrently
      END;
    END IF;
    SELECT * INTO r FROM pg_roles WHERE rolname = spec.name;
    IF r.rolcanlogin IS DISTINCT FROM spec.can_login OR r.rolinherit IS DISTINCT FROM spec.inherit
       OR r.rolbypassrls IS DISTINCT FROM spec.bypassrls OR r.rolcreaterole IS DISTINCT FROM spec.createrole
       OR r.rolsuper THEN
      EXECUTE format('ALTER ROLE %I %s %s %s %s NOSUPERUSER', spec.name,
        CASE WHEN spec.can_login THEN 'LOGIN' ELSE 'NOLOGIN' END,
        CASE WHEN spec.inherit THEN 'INHERIT' ELSE 'NOINHERIT' END,
        CASE WHEN spec.bypassrls THEN 'BYPASSRLS' ELSE 'NOBYPASSRLS' END,
        CASE WHEN spec.createrole THEN 'CREATEROLE' ELSE 'NOCREATEROLE' END);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Schemas, extensions and Supabase's default privileges (per database).
-- ---------------------------------------------------------------------------------------------
CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgcrypto') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'uuid-ossp') THEN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
-- Supabase: everything postgres creates in public is granted to the API roles; row security
-- (and the migrations' own REVOKEs) is what closes it.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. auth (GoTrue's schema). Owned by supabase_auth_admin; API roles get USAGE only, so they can
--    call auth.uid()/auth.jwt() but never read auth.users.
-- ---------------------------------------------------------------------------------------------
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO postgres;

CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');

-- GoTrue's auth.users (columns, types and defaults as in supabase/auth migrations). GoTrue
-- supplies id, aud, role, created_at, updated_at itself: there are no defaults for them.
CREATE TABLE auth.users (
  instance_id uuid,
  id uuid NOT NULL PRIMARY KEY,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text UNIQUE DEFAULT NULL,
  phone_confirmed_at timestamptz,
  phone_change text DEFAULT '',
  phone_change_token varchar(255) DEFAULT '',
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
  email_change_token_current varchar(255) DEFAULT '',
  email_change_confirm_status smallint DEFAULT 0
    CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2),
  banned_until timestamptz,
  reauthentication_token varchar(255) DEFAULT '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false
);
COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';
CREATE UNIQUE INDEX users_email_partial_key ON auth.users (email) WHERE is_sso_user = false;
CREATE INDEX users_instance_id_idx ON auth.users (instance_id);
CREATE INDEX users_instance_id_email_idx ON auth.users (instance_id, lower(email::text));
CREATE INDEX users_is_anonymous_idx ON auth.users (is_anonymous);

CREATE TABLE auth.identities (
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  email text GENERATED ALWAYS AS (lower(identity_data ->> 'email')) STORED,
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider)
);
CREATE INDEX identities_user_id_idx ON auth.identities (user_id);

CREATE TABLE auth.sessions (
  id uuid NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz,
  updated_at timestamptz,
  factor_id uuid,
  aal auth.aal_level,
  not_after timestamptz,
  refreshed_at timestamp,
  user_agent text,
  ip inet,
  tag text
);
CREATE INDEX sessions_user_id_idx ON auth.sessions (user_id);

CREATE TABLE auth.refresh_tokens (
  instance_id uuid,
  id bigserial PRIMARY KEY,
  token varchar(255) UNIQUE,
  user_id varchar(255),
  revoked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  parent varchar(255),
  session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE
);
CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens (session_id, revoked);

-- GoTrue's helpers (supabase/auth migrations 20220224000811 and 20221003041349): the PostgREST
-- claims GUC is request.jwt.claims (whole JWT payload as JSON); request.jwt.claim.<name> is the
-- legacy per-claim form, still honoured first.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';

CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;
COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';

CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;
COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';

CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  select
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;

ALTER TABLE auth.users OWNER TO supabase_auth_admin;
ALTER TABLE auth.identities OWNER TO supabase_auth_admin;
ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;
ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;
ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;
ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), auth.email(), auth.jwt() TO PUBLIC;
-- Supabase's postgres can manage auth data (the SQL editor); the GoTrue stand-in may also log in
-- as postgres. Nothing here is granted to anon / authenticated / service_role.
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;

-- ---------------------------------------------------------------------------------------------
-- 4. storage (storage-api's schema). RLS on, ALL granted to the API roles: policies decide.
-- ---------------------------------------------------------------------------------------------
CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;

CREATE TABLE storage.buckets (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);
CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);

CREATE TABLE storage.objects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  metadata jsonb,
  path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
  version text,
  owner_id text,
  user_metadata jsonb
);
CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);
CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- storage-api's path helpers: foldername('u/s/f.csv') = {u,s}; foldername('f.csv') = {}.
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;

CREATE FUNCTION storage.filename(name text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;

CREATE FUNCTION storage.extension(name text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;

ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;
ALTER TABLE storage.objects OWNER TO supabase_storage_admin;
ALTER FUNCTION storage.foldername(text) OWNER TO supabase_storage_admin;
ALTER FUNCTION storage.filename(text) OWNER TO supabase_storage_admin;
ALTER FUNCTION storage.extension(text) OWNER TO supabase_storage_admin;
GRANT ALL ON storage.buckets, storage.objects TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION storage.foldername(text), storage.filename(text), storage.extension(text)
  TO postgres, anon, authenticated, service_role;
