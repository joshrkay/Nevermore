-- Harness DB: the e2e stack's Supabase bootstrap (roles, auth and storage), then EVERY migration in filename order, so what
-- runs here is what runs in production, firms and all. up.sh appends one \i line per migration (see up.sh), then the seed below.
\i e2e/stack/bootstrap.sql
