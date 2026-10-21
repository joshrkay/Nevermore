import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

/** Why a signed-in session is gone: the person signed out, or it ended on its own (expiry, another tab). */
export type SessionEnded = "signed_out" | "expired";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True for a guest session that hasn't been upgraded to a verified email account. */
  isAnonymous: boolean;
  /** `captchaToken` is the Turnstile token when CAPTCHA protection is on. */
  signInAnonymously: (captchaToken?: string) => Promise<{ error: Error | null }>;
  /** Attaches an email to the current guest and emails a code. `emailInUse` means that address already has an account. */
  requestEmailCode: (email: string) => Promise<{ error: Error | null; emailInUse: boolean }>;
  /** Confirms the emailed code, turning the guest into a verified account in place. */
  verifyEmailCode: (email: string, code: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, companyName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  /** Why the last signed-in session ended; null while signed in, and until someone has signed in. */
  sessionEnded: SessionEnded | null;
  /** `"expired"` records that the app is ending a session the server no longer accepts. */
  signOut: (reason?: SessionEnded) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState<SessionEnded | null>(null);
  // Supabase reports a deliberate sign-out and a lapsed session with the same SIGNED_OUT event, so
  // remember which one we asked for.
  const requestedEnd = useRef<SessionEnded | null>(null);
  const hadUser = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          hadUser.current = true;
          setSessionEnded(null);
        } else if (event === "SIGNED_OUT" && hadUser.current) {
          hadUser.current = false;
          setSessionEnded(requestedEnd.current ?? "expired");
          requestedEnd.current = null;
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) hadUser.current = true;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, companyName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/start`,
        // Copied into the profile row by the handle_new_user trigger.
        data: companyName ? { company_name: companyName } : undefined,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInAnonymously = async (captchaToken?: string) => {
    const { error } = await supabase.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
    return { error: error as Error | null };
  };

  const requestEmailCode = async (email: string) => {
    const { error } = await supabase.auth.updateUser({ email });
    const code = (error as { code?: string } | null)?.code;
    const emailInUse = code === "email_exists" || /already (been )?registered/i.test(error?.message ?? "");
    return { error: error as Error | null, emailInUse };
  };

  const verifyEmailCode = async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email_change" });
    return { error: error as Error | null };
  };

  const signOut = async (reason: SessionEnded = "signed_out") => {
    requestedEnd.current = reason;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
        user, session, loading, isAnonymous: user?.is_anonymous === true, sessionEnded,
        signInAnonymously, requestEmailCode, verifyEmailCode, signUp, signIn, signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
