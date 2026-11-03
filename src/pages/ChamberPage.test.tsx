import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/data/chat";

const session = {
  sessionId: null as string | null,
  resumeFailed: false,
  loadFailed: false,
  expired: null as { at: string | null } | null,
  startNew: vi.fn(),
  startOver: vi.fn(async () => true),
  retryLoad: vi.fn(),
  isLoading: false,
  saveStatus: "idle",
  invalidField: null as string | null,
  retrySave: vi.fn(),
  loadLatest: vi.fn(),
  keepMine: vi.fn(),
  discardChanges: vi.fn(),
  backupOffer: null as { savedAt: string; savedElsewhereSince: boolean } | null,
  restoreBackup: vi.fn(),
  discardBackup: vi.fn(),
  restoredThrough: null as string | null,
  messages: [] as ChatMessage[],
  certification: { status: "none" as string },
};
const auth = {
  isAnonymous: true,
  requestSignInCode: vi.fn(async () => ({ error: null, noAccount: false })),
  verifySignInCode: vi.fn(async () => ({ error: null })),
};
let storageWorks = true;

// The page's own behavior is under test; the session, chat and voice hooks are stand-ins.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useChamberSession", () => ({ useChamberSession: () => session }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/data/intakeBackup", () => ({ browserStorageWorks: () => storageWorks }));
vi.mock("@/hooks/useLenoreVoice", () => ({ useLenoreVoice: () => ({ startVoice: vi.fn(), isConnected: false, hasAgentId: false }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
// The orb only shows what Lenore last said; the workspace panes are not what these tests are about.
vi.mock("@/components/chamber/VoiceOrb", () => ({ default: ({ lastSpokenText }: { lastSpokenText: string }) => <p data-testid="orb">{lastSpokenText}</p> }));
vi.mock("@/components/chamber/TranscriptPanel", () => ({ default: () => null }));
vi.mock("@/components/chamber/workspace/LiveWorkspace", () => ({ default: () => null }));
vi.mock("@/hooks/useLenoreChat", () => ({ useLenoreChat: () => ({ send: vi.fn(), retry: vi.fn(), dismissFailure: vi.fn(), failure: null, pending: false }) }));

const { default: ChamberPage } = await import("./ChamberPage");

const renderPage = () => render(<MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>);
const lenore = (id: string, text: string): ChatMessage => ({ id, sender: "lenore", text, timestamp: "" });
const prospect = (id: string, text: string): ChatMessage => ({ id, sender: "user", text, timestamp: "" });

describe("ChamberPage", () => {
  beforeEach(() => {
    session.sessionId = null;
    session.resumeFailed = false;
    session.loadFailed = false;
    session.expired = null;
    session.saveStatus = "idle";
    session.invalidField = null;
    session.backupOffer = null;
    session.messages = [];
    session.certification = { status: "none" };
    session.startOver.mockReset().mockResolvedValue(true);
    auth.isAnonymous = true;
    storageWorks = true;
    for (const fn of [session.startNew, session.retryLoad, session.retrySave, session.loadLatest, session.keepMine, session.discardChanges, session.restoreBackup, session.discardBackup]) {
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

  describe("getting back to an intake this browser lost", () => {
    it("explains it to a guest and lets them sign in with the email they verified", async () => {
      session.resumeFailed = true;
      renderPage();
      expect(screen.getByText(/doesn't hold the sign-in it was started with/)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("The email you verified"), { target: { value: "jo@acme.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
      await waitFor(() => expect(auth.requestSignInCode).toHaveBeenCalledWith("jo@acme.com"));
      expect(screen.getByText(/never had an email verified can't be recovered/)).toBeInTheDocument();
    });

    it("tells a signed-in prospect the intake belongs to another account", () => {
      auth.isAnonymous = false;
      session.resumeFailed = true;
      renderPage();
      expect(screen.getByText(/belongs to a different account/)).toBeInTheDocument();
      expect(screen.getByLabelText("The email you verified")).toBeInTheDocument();
    });

    it("offers a guest on a fresh intake a way back to an earlier one", async () => {
      session.sessionId = "s1";
      session.messages = [lenore("m1", "Good evening.")];
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Continue an earlier intake" }));
      expect(await screen.findByRole("dialog")).toHaveTextContent("sign in with that email");
      expect(screen.getByLabelText("The email you verified")).toBeInTheDocument();
    });

    it("doesn't offer it once the guest has started talking, or to a verified prospect", () => {
      session.sessionId = "s1";
      session.messages = [lenore("m1", "Good evening."), prospect("m2", "We're Acme")];
      const { unmount } = renderPage();
      expect(screen.queryByRole("button", { name: "Continue an earlier intake" })).not.toBeInTheDocument();
      unmount();
      session.messages = [lenore("m1", "Good evening.")];
      auth.isAnonymous = false;
      renderPage();
      expect(screen.queryByRole("button", { name: "Continue an earlier intake" })).not.toBeInTheDocument();
    });
  });

  it("says when an intake expired and offers a new one", () => {
    session.expired = { at: "2026-10-01T12:00:00Z" };
    renderPage();
    expect(screen.getByRole("heading", { name: "This intake has expired" })).toBeInTheDocument();
    expect(screen.getByText(/kept for 30 days after the last change/)).toBeInTheDocument();
    expect(screen.getByText(/expired on/)).toHaveTextContent("2026");
    fireEvent.click(screen.getByRole("button", { name: "Start a new intake" }));
    expect(session.startNew).toHaveBeenCalledTimes(1);
  });

  describe("start over", () => {
    it("asks first, then archives the intake and begins a blank one", async () => {
      session.sessionId = "s1";
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Start over" }));
      expect(await screen.findByRole("alertdialog")).toHaveTextContent("will be archived");
      expect(session.startOver).not.toHaveBeenCalled();
      const dialog = screen.getByRole("alertdialog");
      await act(async () => { fireEvent.click(dialog.querySelector("button:last-of-type") as HTMLElement); });
      expect(session.startOver).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("says a certified intake stays with the advisor", async () => {
      session.sessionId = "s1";
      session.certification = { status: "stale" };
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Start over" }));
      expect(await screen.findByRole("alertdialog")).toHaveTextContent("stays with your advisor");
    });

    it("stays open and says so when the intake couldn't be set aside", async () => {
      session.sessionId = "s1";
      session.startOver.mockResolvedValue(false);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Start over" }));
      const dialog = await screen.findByRole("alertdialog");
      await act(async () => { fireEvent.click(dialog.querySelector("button:last-of-type") as HTMLElement); });
      expect(await screen.findByText(/couldn't set this intake aside/)).toBeInTheDocument();
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    it("isn't offered before there is an intake", () => {
      renderPage();
      expect(screen.queryByRole("button", { name: "Start over" })).not.toBeInTheDocument();
    });
  });

  it("offers back unsaved changes this browser kept, and warns when restoring would replace newer ones", () => {
    session.sessionId = "s1";
    session.backupOffer = { savedAt: "2026-11-02T15:30:00Z", savedElsewhereSince: true };
    renderPage();
    expect(screen.getByText(/didn't reach our server/)).toHaveTextContent("saved from somewhere else since");
    fireEvent.click(screen.getByRole("button", { name: "Restore my changes" }));
    expect(session.restoreBackup).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Discard them" }));
    expect(session.discardBackup).toHaveBeenCalledTimes(1);
  });

  it("warns when this browser won't keep site data, so the prospect can't come back", () => {
    storageWorks = false;
    session.sessionId = "s1";
    renderPage();
    expect(screen.getByText(/isn't keeping site data/)).toBeInTheDocument();
  });

  it("shows Lenore's latest line under the orb, not a second hello", () => {
    session.sessionId = "s1";
    session.messages = [lenore("m1", "Good evening."), prospect("m2", "We're Acme"), lenore("m3", "Acme it is. How many people?")];
    renderPage();
    expect(screen.getByTestId("orb")).toHaveTextContent("Acme it is. How many people?");
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

    it("offers a new intake when the saved one is gone", () => {
      session.saveStatus = "missing";
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Start a new intake" }));
      expect(session.startNew).toHaveBeenCalledTimes(1);
    });

    it("offers a new intake, with what's on screen, when the open one expires", () => {
      session.saveStatus = "expired";
      renderPage();
      expect(screen.getByRole("alert")).toHaveTextContent("this intake has expired");
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
