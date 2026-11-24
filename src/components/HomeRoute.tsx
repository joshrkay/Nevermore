import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import Navbar from "@/components/Navbar";
import LandingPage from "@/pages/LandingPage";
import { HOME_PATH } from "@/data/home";

/**
 * What `/` shows (D-52). At a firm's address a signed-in person is sent to the workspace instead of the landing page: to Home (CRM-H1, D-2201). The
 * address gate (FirmAddressGate) lets only a current member of that firm reach a route there, so a signed-in person who
 * gets this far is one; everyone else keeps today's page: the bare domain and www, a signed-out visitor, and a guest
 * (a prospect's anonymous session) at a firm's address.
 */
const HomeRoute = () => {
  const firm = useFirmAddress();
  const { user, isAnonymous } = useAuth();
  if (firm.status === "known" && user && !isAnonymous) return <Navigate to={HOME_PATH} replace />;
  return (
    <>
      <Navbar />
      <LandingPage />
    </>
  );
};

export default HomeRoute;
