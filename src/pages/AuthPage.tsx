import { useState } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { RavenIcon } from "@/components/RavenLogo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, isAnonymous, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { from?: { pathname: string; search?: string }; audience?: string } | null;
  const fromLocation = routeState?.from;
  const from = fromLocation ? `${fromLocation.pathname}${fromLocation.search ?? ""}` : "/start";
  // Advisors are given accounts; they don't sign up here.
  const forAdvisor = routeState?.audience === "advisor";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, companyName.trim() || undefined);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Check your email to confirm your account.");
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        navigate(from, { replace: true });
      }
    }
    setLoading(false);
  };

  // A guest session isn't a sign-in: let the guest sign in properly (advisor pages send guests here).
  if (!authLoading && user && !isAnonymous) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 noise-overlay">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <RavenIcon className="w-8 h-8 text-primary" />
          <span className="font-display text-lg">Edgar Allan Advisory</span>
        </Link>

        <div className="bg-card border border-border rounded-xl p-8">
          <h1 className="font-display text-2xl font-bold text-center mb-2">
            {forAdvisor ? "Advisor Sign In" : isSignUp ? "Enter The Chamber" : "Welcome Back"}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            {forAdvisor
              ? "Sign in with your advisor account to continue."
              : isSignUp
                ? "Create your account to begin underwriting."
                : "Sign in to continue your session."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Meridian Creative Group"
                  className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          {!forAdvisor && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                {isSignUp ? "Sign in" : "Create one"}
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © Edgar Allan Advisory. All nightmares are optional.
        </p>
      </motion.div>
    </div>
  );
};

export default AuthPage;
