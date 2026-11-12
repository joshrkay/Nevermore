-- A broker's connected mailbox (joshrkay/Nevermore#92, story M-4.3; docs/adr/0005-brokers-send-through-their-own-mailbox.md).
--
-- To send a submission from a broker's own address the product keeps the refresh token that lets it send, and nothing
-- else of their mailbox: the permission is send-only (src/data/mailboxScopes.ts), so the product can't read, list or
-- search a mailbox with it.
--
-- * public.broker_mailboxes: one row per broker. The token is stored encrypted by the mailbox function (AES-GCM, with a
--   key only that function holds, bound to the broker's id), so the database holds ciphertext it can't read. The table
--   is readable and writable by no API role, advisors and admins included: the browser learns whether a mailbox is
--   connected only through my_mailbox(), which never returns the token.
-- * mailbox_store(), mailbox_secret() and mailbox_delete() are the only ways in, and only the service role (the mailbox
--   function) may call them.
-- * The token is deleted when the broker disconnects, when Google or Microsoft revoke the permission (the function finds
--   out when a refresh is refused), when the account is deleted, and when the broker no longer holds the advisor or
--   admin role: a send then fails with a plain message and nothing is sent to a PEO.
--
-- Deploy this migration before the mailbox function.

SET lock_timeout = '5s';

CREATE TABLE public.broker_mailboxes (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  address text NOT NULL,
  scope text NOT NULL,
  token_ciphertext text NOT NULL,
  token_iv text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  token_updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_mailboxes ADD CONSTRAINT broker_mailboxes_check CHECK (
  provider IN ('google', 'microsoft')
  AND char_length(address) BETWEEN 3 AND 320
  AND char_length(scope) BETWEEN 1 AND 1000
  AND char_length(token_ciphertext) BETWEEN 1 AND 8000
  AND char_length(token_iv) BETWEEN 1 AND 100
);

-- Nobody reads or writes it through the API. No policy is the point.
ALTER TABLE public.broker_mailboxes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.broker_mailboxes FROM PUBLIC, anon, authenticated;

-- What the signed-in broker may know about their own mailbox: whether it is connected, to whom and since when.
CREATE FUNCTION public.my_mailbox()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object('connected', true, 'provider', m.provider, 'address', m.address, 'connected_at', m.connected_at)
     FROM public.broker_mailboxes m WHERE m.user_id = auth.uid()),
    jsonb_build_object('connected', false));
$$;

-- Connects, or reconnects, a broker's mailbox. The ciphertext is the function's; the database never sees the token.
CREATE FUNCTION public.mailbox_store(
  p_user_id uuid, p_provider text, p_address text, p_scope text, p_token_ciphertext text, p_token_iv text, p_rotated boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user_id AND r.role::text IN ('advisor', 'admin')) THEN
    RAISE EXCEPTION 'Only an advisor can connect a mailbox' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (p_user_id, p_provider, p_address, p_scope, p_token_ciphertext, p_token_iv)
  ON CONFLICT (user_id) DO UPDATE
  SET provider = EXCLUDED.provider, address = EXCLUDED.address, scope = EXCLUDED.scope,
      token_ciphertext = EXCLUDED.token_ciphertext, token_iv = EXCLUDED.token_iv, token_updated_at = now(),
      -- A token Microsoft handed back on a refresh replaces the old one; the broker has not connected again.
      connected_at = CASE WHEN p_rotated THEN public.broker_mailboxes.connected_at ELSE now() END;
  RETURN jsonb_build_object('connected', true);
END;
$$;

-- The stored mailbox of a broker, with the encrypted token, for the function that sends. Null when none is connected.
CREATE FUNCTION public.mailbox_secret(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('provider', m.provider, 'address', m.address, 'scope', m.scope,
                            'token_ciphertext', m.token_ciphertext, 'token_iv', m.token_iv)
  FROM public.broker_mailboxes m WHERE m.user_id = p_user_id;
$$;

-- Disconnects: deletes the token. True when there was one.
CREATE FUNCTION public.mailbox_delete(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.broker_mailboxes WHERE user_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

-- A broker who no longer holds the advisor or admin role no longer sends as themselves through the product.
CREATE FUNCTION public.drop_mailbox_without_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = OLD.user_id AND r.role::text IN ('advisor', 'admin')) THEN
    DELETE FROM public.broker_mailboxes WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER user_roles_drop_mailbox
  AFTER DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.drop_mailbox_without_role();

REVOKE ALL ON FUNCTION public.my_mailbox(), public.mailbox_store(uuid, text, text, text, text, text, boolean),
  public.mailbox_secret(uuid), public.mailbox_delete(uuid), public.drop_mailbox_without_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_mailbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mailbox_store(uuid, text, text, text, text, text, boolean), public.mailbox_secret(uuid),
  public.mailbox_delete(uuid) TO service_role;
