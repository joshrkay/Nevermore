import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  sessionId: null as string | null,
  resumeFailed: false,
  loadFailed: false,
  expired: false,
  startNew: vi.fn(),
  retryLoad: vi.fn(),
  isLoading: false,
  saveStatus: "idle",
  invalidField: null as string | null,
  retrySave: vi.fn(),
  loadLatest: vi.fn(),
  keepMine: vi.fn(),
  discardChanges: vi.fn(),
};

const auth = { isAnonymous: true };

// The page's own behavior is under test; the session, chat and voice hooks are stand-ins.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/hooks/useChamberSession", () => ({ useChamberSession: () => session }));
vi.mock("@/hooks/useLenoreVoice", () => ({ useLenoreVoice: () => ({ startVoice: vi.fn(), isConnected: false, hasAgentId: false }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
// The workspace panes are not what these tests are about.
vi.mock("@/components/chamber/VoiceOrb", () => ({ default: () => null }));
vi.mock("@/components/chamber/TranscriptPanel", () => ({ default: () => null }));
vi.mock("@/components/chamber/workspace/LiveWorkspace", () => ({ default: () => null }));
vi.mock("@/hooks/useLenoreChat", () => ({ useLenoreChat: () => ({ send: vi.fn(), retry: vi.fn(), dismissFailure: vi.fn(), failure: null, pending: false }) }));

const { default: ChamberPage } = await import("./ChamberPage");

const renderPage = (url = "/start") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/start" element={<ChamberPage />} />
        <Route path="/login" element={<LoginStandIn />} />
      </Routes>
    </MemoryRouter>,
  );

// Shows where the sign-in page would send the prospect afterwards.
const LoginStandIn = () => {
  const from = (useLocation().state as { from?: { pathname: string; search?: string } } | null)?.from;
  return <p>Sign-in page, then {from ? `${from.pathname}${from.search ?? ""}` : "nowhere"}</p>;
};

describe("ChamberPage", () => {
  beforeEach(() => {
    session.resumeFailed = false;
    session.loadFailed = false;
    session.expired = false;
    auth.isAnonymous = true;
    session.saveStatus = "idle";
    session.invalidField = null;
    for (const fn of [session.startNew, session.retryLoad, session.retrySave, session.loadLatest, session.keepMine, session.discardChanges]) {
      fn.mockClear();
    }
  });

  it("offers to try again or start a new intake when the prospect's intake couldn't be loaded", () => {
    session.loadFailed = true;
    renderPage();
    expect(screen.getByRole("heading", { name: "We couldn't load your intake" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(session.retryLoad).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Start a new intake" }));
    expect(session.startNew).toHaveBeenCalledTimes(1);
  });

  it("offers a new intake when a linked intake can't be opened", () => {
    session.resumeFailed = true;
    renderPage();
    expect(screen.getByRole("heading", { name: "We couldn't open that intake" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start a new intake" }));
    expect(session.startNew).toHaveBeenCalledTimes(1);
  });

  describe("when a linked intake can't be opened", () => {
    it("tells a guest only what can work: the browser it was started in, or signing in with a password account", () => {
      session.resumeFailed = true;
      renderPage("/start?session=s7");
      expect(screen.getByText(/can only be reopened in the browser it was started in/)).toBeInTheDocument();
      expect(screen.getByText(/If you started it with an account and password, sign in to open it/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: "Sign in" }));
      expect(screen.getByText("Sign-in page, then /start?session=s7")).toBeInTheDocument();
    });

    it("doesn't send a signed-in prospect to a sign-in they can't use from here", () => {
      session.resumeFailed = true;
      auth.isAnonymous = false;
      renderPage("/start?session=s7");
      expect(screen.getByText(/belongs to a different account/)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
      expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Start a new intake" }));
      expect(session.startNew).toHaveBeenCalledTimes(1);
    });
  });

  it("says an expired intake has expired, and offers a new one", () => {
    session.expired = true;
    renderPage("/start?session=s7");
    expect(screen.getByRole("heading", { name: "Your intake has expired" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "We couldn't open that intake" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start a new intake" }));
    expect(session.startNew).toHaveBeenCalledTimes(1);
  });

  describe("when saving has stopped", () => {
    it("lets the prospect load what was saved elsewhere, or keep their own changes", () => {
      session.saveStatus = "conflict";
      renderPage();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Load latest" }));
      expect(session.loadLatest).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
      expect(session.keepMine).toHaveBeenCalledTimes(1);
    });

    it("names the refused answer and lets the prospect discard their changes", () => {
      session.saveStatus = "invalid";
      session.invalidField = "Employee count";
      renderPage();
      expect(screen.getByRole("alert")).toHaveTextContent("Please check: Employee count.");
      fireEvent.click(screen.getByRole("button", { name: "Discard my changes" }));
      expect(session.discardChanges).toHaveBeenCalledTimes(1);
    });

    it("offers a new intake when the intake expires while it is open", () => {
      session.saveStatus = "expired";
      renderPage();
      expect(screen.getByRole("alert")).toHaveTextContent("this intake has expired");
      fireEvent.click(screen.getByRole("button", { name: "Start a new intake" }));
      expect(session.startNew).toHaveBeenCalledTimes(1);
    });

    it("offers a new intake when the saved one is gone", () => {
      session.saveStatus = "missing";
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Start a new intake" }));
      expect(session.startNew).toHaveBeenCalledTimes(1);
    });

    it("still offers Retry for an ordinary failed save", () => {
      session.saveStatus = "failed";
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(session.retrySave).toHaveBeenCalledTimes(1);
    });
  });
});
