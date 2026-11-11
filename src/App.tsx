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
import RequireAdvisor from "./components/RequireAdvisor";
import IntakeConsentGate from "./components/chamber/IntakeConsentGate";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ChamberPage from "./pages/ChamberPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";

// jsPDF and html2canvas are only needed here, so keep them out of the main bundle.
const ManuscriptPage = lazy(() => import("./pages/ManuscriptPage"));
// Advisor tools are only for advisors; keep them out of the prospect's bundle.
const AdvisorDashboardPage = lazy(() => import("./pages/advisor/AdvisorDashboardPage"));
const AdvisorSubmissionPage = lazy(() => import("./pages/advisor/AdvisorSubmissionPage"));
const AdvisorOutboxPage = lazy(() => import("./pages/advisor/AdvisorOutboxPage"));
const AdvisorFunnelPage = lazy(() => import("./pages/advisor/AdvisorFunnelPage"));
const AdvisorPartnersPage = lazy(() => import("./pages/advisor/AdvisorPartnersPage"));
const AdvisorPeosPage = lazy(() => import("./pages/advisor/AdvisorPeosPage"));
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
        <BrowserRouter>
          {/* The title, description and robots rule of the page at this address (src/data/seo.ts). */}
          <PageMeta />
          <ErrorBoundary>
            <Suspense fallback={null}>
              <AuthRedirectGate>
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
                {/* Nothing of the Chamber opens until the account has agreed to how intake information is used. */}
                <Route path="/start" element={<RequireAuth><IntakeConsentGate><ChamberPage /></IntakeConsentGate></RequireAuth>} />
                <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/manuscript" element={<ManuscriptPage />} />
                <Route path="/manuscript/demo" element={<ManuscriptPage demo />} />
                {/* A submission by its File ID; row security decides who may read it. */}
                <Route path="/manuscript/:reference" element={<ManuscriptPage />} />
                <Route path="/advisor" element={<RequireAdvisor><AdvisorDashboardPage /></RequireAdvisor>} />
                <Route path="/advisor/submissions/:id" element={<RequireAdvisor><AdvisorSubmissionPage /></RequireAdvisor>} />
                <Route path="/advisor/outbox" element={<RequireAdvisor><AdvisorOutboxPage /></RequireAdvisor>} />
                <Route path="/advisor/funnel" element={<RequireAdvisor><AdvisorFunnelPage /></RequireAdvisor>} />
                <Route path="/advisor/partners" element={<RequireAdvisor><AdvisorPartnersPage /></RequireAdvisor>} />
                <Route path="/advisor/peos" element={<RequireAdvisor><AdvisorPeosPage /></RequireAdvisor>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </AuthRedirectGate>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
