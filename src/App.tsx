import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthRedirectGate from "./components/AuthRedirectGate";
import Navbar from "./components/Navbar";
import PageMeta from "./components/PageMeta";
import RequireAuth from "./components/RequireAuth";
import RequireFirm, { RequirePlatformAdmin } from "./components/RequireFirm";
import FirmAddressGate from "./components/FirmAddressGate";
import { FirmAddressProvider } from "@/hooks/useFirmAddress";
import IntakeConsentGate from "./components/chamber/IntakeConsentGate";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ChamberPage from "./pages/ChamberPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";

// jsPDF and html2canvas are only needed here, so keep them out of the main bundle.
const ManuscriptPage = lazy(() => import("./pages/ManuscriptPage"));
// The firm's console is only for its members; keep it out of the prospect's bundle.
const BrokerSignInPage = lazy(() => import("./pages/BrokerSignInPage"));
const BrokerCallbackPage = lazy(() => import("./pages/BrokerCallbackPage"));
const SecondFactorPage = lazy(() => import("./pages/SecondFactorPage"));
const AdvisorDashboardPage = lazy(() => import("./pages/advisor/AdvisorDashboardPage"));
const AdvisorSubmissionPage = lazy(() => import("./pages/advisor/AdvisorSubmissionPage"));
const AdvisorOutboxPage = lazy(() => import("./pages/advisor/AdvisorOutboxPage"));
const AdvisorFunnelPage = lazy(() => import("./pages/advisor/AdvisorFunnelPage"));
const AdvisorPartnersPage = lazy(() => import("./pages/advisor/AdvisorPartnersPage"));
const AdvisorPeosPage = lazy(() => import("./pages/advisor/AdvisorPeosPage"));
const AdvisorHeldMailPage = lazy(() => import("./pages/advisor/AdvisorHeldMailPage"));
const AdvisorMailboxPage = lazy(() => import("./pages/advisor/AdvisorMailboxPage"));
const AdvisorOrganisationsPage = lazy(() => import("./pages/advisor/AdvisorOrganisationsPage"));
const AdvisorActivityPage = lazy(() => import("./pages/advisor/AdvisorActivityPage"));
const AdvisorMembersPage = lazy(() => import("./pages/advisor/AdvisorMembersPage"));
const AdvisorFirmsPage = lazy(() => import("./pages/advisor/AdvisorFirmsPage"));
const SignUpFirmPage = lazy(() => import("./pages/SignUpFirmPage"));
const JoinFirmPage = lazy(() => import("./pages/JoinFirmPage"));
const FirmInvitationsPage = lazy(() => import("./pages/FirmInvitationsPage"));
// Read rarely, so kept out of the main bundle too.
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <FirmAddressProvider>
        <BrowserRouter>
          {/* The title, description and robots rule of the page at this address (src/data/seo.ts). */}
          <PageMeta />
          <ErrorBoundary>
            <Suspense fallback={null}>
              <AuthRedirectGate>
              <FirmAddressGate>
              <Routes>
                <Route
                  path="/"
                  element={
                    <>
                      <Navbar />
                      <LandingPage />
                    </>
                  }
                />
                <Route path="/login" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/firms/new" element={<SignUpFirmPage />} />
                <Route path="/join" element={<JoinFirmPage />} />
                <Route path="/firm/invitations" element={<FirmInvitationsPage />} />
                <Route path="/broker/sign-in" element={<BrokerSignInPage />} />
                <Route path="/broker/callback" element={<BrokerCallbackPage />} />
                {/* Nothing of the Chamber opens until the account has agreed to how intake information is used. */}
                <Route path="/start" element={<RequireAuth><IntakeConsentGate><ChamberPage /></IntakeConsentGate></RequireAuth>} />
                <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/manuscript" element={<ManuscriptPage />} />
                <Route path="/manuscript/demo" element={<ManuscriptPage demo />} />
                {/* A submission by its File ID; row security decides who may read it. */}
                <Route path="/manuscript/:reference" element={<ManuscriptPage />} />
                <Route path="/advisor/second-factor" element={<SecondFactorPage />} />
                <Route path="/advisor" element={<RequireFirm><AdvisorDashboardPage /></RequireFirm>} />
                <Route path="/advisor/submissions/:id" element={<RequireFirm><AdvisorSubmissionPage /></RequireFirm>} />
                <Route path="/advisor/outbox" element={<RequireFirm><AdvisorOutboxPage /></RequireFirm>} />
                <Route path="/advisor/funnel" element={<RequireFirm><AdvisorFunnelPage /></RequireFirm>} />
                <Route path="/advisor/partners" element={<RequireFirm><AdvisorPartnersPage /></RequireFirm>} />
                <Route path="/advisor/peos" element={<RequireFirm><AdvisorPeosPage /></RequireFirm>} />
                <Route path="/advisor/held" element={<RequirePlatformAdmin><AdvisorHeldMailPage /></RequirePlatformAdmin>} />
                <Route path="/advisor/mailbox" element={<RequireFirm><AdvisorMailboxPage /></RequireFirm>} />
                <Route path="/advisor/firms" element={<RequirePlatformAdmin><AdvisorFirmsPage /></RequirePlatformAdmin>} />
                <Route path="/advisor/organisations" element={<RequirePlatformAdmin><AdvisorOrganisationsPage /></RequirePlatformAdmin>} />
                <Route path="/advisor/activity" element={<RequireFirm as="owner"><AdvisorActivityPage /></RequireFirm>} />
                <Route path="/advisor/members" element={<RequireFirm as="owner" ownersOnly="see and change its members"><AdvisorMembersPage /></RequireFirm>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </FirmAddressGate>
              </AuthRedirectGate>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        </FirmAddressProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
