import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import RequireAuth from "./components/RequireAuth";
import RequireAdvisor from "./components/RequireAdvisor";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import ChamberPage from "./pages/ChamberPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";

// jsPDF and html2canvas are only needed here, so keep them out of the main bundle.
const ManuscriptPage = lazy(() => import("./pages/ManuscriptPage"));
// Advisor tools are only for advisors; keep them out of the prospect's bundle.
const AdvisorDashboardPage = lazy(() => import("./pages/advisor/AdvisorDashboardPage"));
const AdvisorSubmissionPage = lazy(() => import("./pages/advisor/AdvisorSubmissionPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={null}>
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
                <Route path="/start" element={<RequireAuth><ChamberPage /></RequireAuth>} />
                <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                <Route path="/manuscript" element={<ManuscriptPage />} />
                <Route path="/manuscript/demo" element={<ManuscriptPage demo />} />
                <Route path="/advisor" element={<RequireAdvisor><AdvisorDashboardPage /></RequireAdvisor>} />
                <Route path="/advisor/submissions/:id" element={<RequireAdvisor><AdvisorSubmissionPage /></RequireAdvisor>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
