import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Route, RouterProvider, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import UserBoundary from "@/components/UserBoundary";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthRedirectGate from "./components/AuthRedirectGate";
import PageMeta from "./components/PageMeta";
import RequireAuth from "./components/RequireAuth";
import RequireFirm, { RequirePlatformAdmin } from "./components/RequireFirm";
import FirmAddressGate from "./components/FirmAddressGate";
import { FirmAddressProvider } from "@/hooks/useFirmAddress";
import IntakeConsentGate from "./components/chamber/IntakeConsentGate";
import HomeRoute from "./components/HomeRoute";
import WorkspaceShell from "./components/workspace/WorkspaceShell";
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
const BundleLinkPage = lazy(() => import("./pages/BundleLinkPage"));
const FileLinkPage = lazy(() => import("./pages/FileLinkPage"));
const SecondFactorPage = lazy(() => import("./pages/SecondFactorPage"));
const AdvisorDashboardPage = lazy(() => import("./pages/advisor/AdvisorDashboardPage"));
const AdvisorSubmissionPage = lazy(() => import("./pages/advisor/AdvisorSubmissionPage"));
const AccountsPage = lazy(() => import("./pages/accounts/AccountsPage"));
const LeadsPage = lazy(() => import("./pages/leads/LeadsPage"));
const InboxPage = lazy(() => import("./pages/inbox/InboxPage"));
const AccountPage = lazy(() => import("./pages/accounts/AccountPage"));
const ContactPage = lazy(() => import("./pages/contacts/ContactPage"));
const LeadPage = lazy(() => import("./pages/leads/LeadPage"));
const OpportunityPage = lazy(() => import("./pages/opportunities/OpportunityPage"));
const AdvisorOutboxPage = lazy(() => import("./pages/advisor/AdvisorOutboxPage"));
const AdvisorFunnelPage = lazy(() => import("./pages/advisor/AdvisorFunnelPage"));
const AdvisorPartnersPage = lazy(() => import("./pages/advisor/AdvisorPartnersPage"));
const AdvisorPeosPage = lazy(() => import("./pages/advisor/AdvisorPeosPage"));
const AdvisorHeldMailPage = lazy(() => import("./pages/advisor/AdvisorHeldMailPage"));
const AdvisorMailboxPage = lazy(() => import("./pages/advisor/AdvisorMailboxPage"));
const AdvisorActivityPage = lazy(() => import("./pages/advisor/AdvisorActivityPage"));
const AdvisorSettingsPage = lazy(() => import("./pages/advisor/AdvisorSettingsPage"));
const AdvisorMembersPage = lazy(() => import("./pages/advisor/AdvisorMembersPage"));
const AdvisorFirmsPage = lazy(() => import("./pages/advisor/AdvisorFirmsPage"));
const SignUpFirmPage = lazy(() => import("./pages/SignUpFirmPage"));
const JoinFirmPage = lazy(() => import("./pages/JoinFirmPage"));
const FirmInvitationsPage = lazy(() => import("./pages/FirmInvitationsPage"));
const ChooseFirmPage = lazy(() => import("./pages/ChooseFirmPage"));
// Read rarely, so kept out of the main bundle too.
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));

const queryClient = new QueryClient();

const AppRoutes = () => (
  <>
          {/* The title, description and robots rule of the page at this address (src/data/seo.ts). */}
          <PageMeta />
          <ErrorBoundary>
            <Suspense fallback={null}>
              <AuthRedirectGate>
              <FirmAddressGate>
              <Routes>
                <Route path="/" element={<HomeRoute />} />
                <Route path="/login" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/firms/new" element={<SignUpFirmPage />} />
                <Route path="/join" element={<JoinFirmPage />} />
                <Route path="/choose-firm" element={<ChooseFirmPage />} />
                <Route path="/broker/sign-in" element={<BrokerSignInPage />} />
                <Route path="/broker/callback" element={<BrokerCallbackPage />} />
                {/* Nothing of the Chamber opens until the account has agreed to how intake information is used. */}
                <Route path="/start" element={<RequireAuth><IntakeConsentGate><ChamberPage /></IntakeConsentGate></RequireAuth>} />
                <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                {/* The bundle link a PEO opens (ADR 0003): no sign-in, the edge function checks the token. */}
                <Route path="/b/:token" element={<BundleLinkPage />} />
                <Route path="/f" element={<FileLinkPage />} />
                <Route path="/manuscript" element={<ManuscriptPage />} />
                <Route path="/manuscript/demo" element={<ManuscriptPage demo />} />
                {/* A submission by its File ID; row security decides who may read it. */}
                <Route path="/manuscript/:reference" element={<ManuscriptPage />} />
                <Route path="/advisor/second-factor" element={<SecondFactorPage />} />
                {/* The workspace: one layout route puts the firm guard and the menu around every member page, which keep their
                    /advisor paths (D-37). A page that needs more than membership asks for it inside (as="owner"). */}
                <Route element={<RequireFirm><WorkspaceShell /></RequireFirm>}>
                  <Route path="/advisor" element={<AdvisorDashboardPage />} />
                  <Route path="/advisor/submissions/:id" element={<AdvisorSubmissionPage />} />
                  <Route path="/inbox" element={<InboxPage />} />
                  <Route path="/leads" element={<LeadsPage />} />
                  <Route path="/leads/:id" element={<LeadPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/accounts/:id" element={<AccountPage />} />
                  <Route path="/contacts/:id" element={<ContactPage />} />
                  <Route path="/opportunities/:id" element={<OpportunityPage />} />
                  <Route path="/advisor/outbox" element={<AdvisorOutboxPage />} />
                  <Route path="/advisor/funnel" element={<AdvisorFunnelPage />} />
                  <Route path="/advisor/partners" element={<AdvisorPartnersPage />} />
                  <Route path="/advisor/peos" element={<AdvisorPeosPage />} />
                  <Route path="/advisor/mailbox" element={<AdvisorMailboxPage />} />
                  <Route path="/advisor/activity" element={<RequireFirm as="owner" allowSupport><AdvisorActivityPage /></RequireFirm>} />
                  <Route path="/advisor/members" element={<RequireFirm as="owner" allowSupport ownersOnly="see and change its members"><AdvisorMembersPage /></RequireFirm>} />
                  <Route path="/firm/invitations" element={<FirmInvitationsPage />} />
                  <Route path="/settings" element={<AdvisorSettingsPage />} />
                </Route>
                {/* The platform's own pages stay outside the workspace, with the console header. */}
                <Route path="/advisor/held" element={<RequirePlatformAdmin><AdvisorHeldMailPage /></RequirePlatformAdmin>} />
                <Route path="/advisor/firms" element={<RequirePlatformAdmin><AdvisorFirmsPage /></RequirePlatformAdmin>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </FirmAddressGate>
              </AuthRedirectGate>
            </Suspense>
          </ErrorBoundary>
  </>
);

// A data router, so a form with unsaved changes can ask before the app moves to another page (CRM-S4.1, useUnsavedChangesGuard).
// One splat route holds the whole route table below, which is unchanged.
const router = createBrowserRouter([{ path: "*", element: <AppRoutes /> }]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <UserBoundary>
          <FirmAddressProvider>
            <RouterProvider router={router} />
          </FirmAddressProvider>
        </UserBoundary>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
