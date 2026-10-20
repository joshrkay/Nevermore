import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RavenIcon } from "./RavenLogo";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

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
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
