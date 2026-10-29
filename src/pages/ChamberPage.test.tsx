import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  sessionId: null as string | null,
  resumeFailed: false,
  loadFailed: false,
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

// The page's own behavior is under test; the session, chat and voice hooks are stand-ins.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useChamberSession", () => ({ useChamberSession: () => session }));
vi.mock("@/hooks/useLenoreVoice", () => ({ useLenoreVoice: () => ({ startVoice: vi.fn(), isConnected: false, hasAgentId: false }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
// The workspace panes are not what these tests are about.
vi.mock("@/components/chamber/VoiceOrb", () => ({ default: () => null }));
vi.mock("@/components/chamber/TranscriptPanel", () => ({ default: () => null }));
vi.mock("@/components/chamber/workspace/LiveWorkspace", () => ({ default: () => null }));
vi.mock("@/hooks/useLenoreChat", () => ({ useLenoreChat: () => ({ send: vi.fn(), retry: vi.fn(), dismissFailure: vi.fn(), failure: null, pending: false }) }));

const { default: ChamberPage } = await import("./ChamberPage");

const renderPage = () => render(<MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>);

describe("ChamberPage", () => {
  beforeEach(() => {
    session.resumeFailed = false;
    session.loadFailed = false;
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
      expect(screen.getByRole("alert")).toHaveTextContent("Employee count isn't valid");
      fireEvent.click(screen.getByRole("button", { name: "Discard my changes" }));
      expect(session.discardChanges).toHaveBeenCalledTimes(1);
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
