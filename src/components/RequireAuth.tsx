import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { RavenIcon } from "./RavenLogo";
import { useAuth } from "@/hooks/useAuth";

// Sends signed-out visitors to /login, remembering where they were headed.
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RavenIcon className="w-10 h-10 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-sm text-muted-foreground">Entering The Chamber...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default RequireAuth;
