
CREATE TABLE public.chamber_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chamber_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chamber_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON public.chamber_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.chamber_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.chamber_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_chamber_sessions_updated_at
  BEFORE UPDATE ON public.chamber_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
