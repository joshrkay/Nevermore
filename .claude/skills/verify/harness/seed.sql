-- Seed: a verified prospect (with a profile), a guest and an advisor-to-be (user c). Firms and memberships are seeded by the scenario.
INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'jo@acme.example', false, now(), now()),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', NULL, true, now(), now()),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'pat@globex.example', false, now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (user_id, company_name, contact_name, phone)
VALUES ('00000000-0000-0000-0000-00000000000a', 'Acme (profile)', 'Joanna Doe', '555-0100')
ON CONFLICT (user_id) DO UPDATE SET company_name = EXCLUDED.company_name;
-- The prospect has agreed to the intake consent in force, which a browser write to chamber_sessions requires (EA004).
INSERT INTO public.intake_consents (user_id, consent_version, consent_text)
VALUES ('00000000-0000-0000-0000-00000000000a', public.intake_consent_version(), 'I agree.')
ON CONFLICT DO NOTHING;
