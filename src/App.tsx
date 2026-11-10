import { lazy, Suspense, useEffect } from "react";
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
import NotFound from "./pages/NotFound";
import { BrandMark } from "./components/BrandMark";
import { loadChamberPage, loadProfilePage, preloadIntake } from "./lib/lazyPages";

// The intake carries the voice client, by far the largest dependency, and the landing page needs none of it
// (src/lib/lazyPages.ts). The profile page is only for signed-in prospects.
const ChamberPage = lazy(loadChamberPage);
const ProfilePage = lazy(loadProfilePage);

// What /start shows while the intake's code arrives: the same screen RequireAuth shows while it opens a guest
// session, so the two waits read as one.
const IntakeLoading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <BrandMark className="w-10 h-10 text-primary mx-auto mb-4 animate-pulse" />
      <p className="text-sm text-muted-foreground">Opening your intake...</p>
    </div>
  </div>
);

// Fetches the intake's code as soon as /start opens, alongside the sign-in and consent checks, not after them.
const PreloadIntake = () => {
  useEffect(preloadIntake, []);
  return null;
};

// jsPDF and html2canvas are only needed here, so keep them out of the main bundle.
const ManuscriptPage = lazy(() => import("./pages/ManuscriptPage"));
// Advisor tools are only for advisors; keep them out of the prospect's bundle.
const AdvisorDashboardPage = lazy(() => import("./pages/advisor/AdvisorDashboardPage"));
const AdvisorSubmissionPage = lazy(() => import("./pages/advisor/AdvisorSubmissionPage"));
const AdvisorOutboxPage = lazy(() => import("./pages/advisor/AdvisorOutboxPage"));
const AdvisorFunnelPage = lazy(() => import("./pages/advisor/AdvisorFunnelPage"));
const AdvisorPartnersPage = lazy(() => import("./pages/advisor/AdvisorPartnersPage"));
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
                <Route
                  path="/start"
                  element={
                    <>
                      <PreloadIntake />
                      <RequireAuth>
                        <IntakeConsentGate>
                          <Suspense fallback={<IntakeLoading />}>
                            <ChamberPage />
                          </Suspense>
                        </IntakeConsentGate>
                      </RequireAuth>
                    </>
                  }
                />
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
