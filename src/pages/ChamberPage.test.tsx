import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "@/data/chamberTypes";
import type { ChatMessage } from "@/data/chat";
import type { IntakeState, ProvenanceMap } from "@/data/provenance";
import { READY_MESSAGE } from "@/data/followUp";
import type { OrbState } from "@/components/chamber/VoiceOrb";
import type { VoiceState } from "@/data/voiceSession";

const session = {
  sessionId: null as string | null,
  fileId: null as string | null,
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
  updateIntake: vi.fn(),
  addMessage: vi.fn(),
  readIntake: vi.fn(),
  conversationEpoch: {} as object,
  verifiedFields: new Set<string>() as ReadonlySet<string>,
  chamberData: { ...EMPTY_CHAMBER_DATA } as ChamberData,
  provenance: {} as ProvenanceMap,
};

// What the page hands the voice and chat hooks, so their extraction paths can be driven directly.
const hooks = {
  workspace: null as null | { verified?: ReadonlySet<string> },
  voice: null as null | { onSpokenMessage: (message: ChatMessage) => unknown; context: string },
  chat: null as null | {
    onExtracted: (extracted: unknown, response: unknown, message: { id: string; text: string; spoken?: boolean }) => void;
    onOrbStateChange: (state: OrbState) => void;
    readIntake?: unknown;
  },
  orb: null as null | { orbState: OrbState; voice: VoiceState; onTypeInstead: () => void },
};
const voice = {
  isConnected: false,
  state: { status: "idle", attempt: 0 } as VoiceState,
  dismissFailure: vi.fn(),
};
let mobile = false;
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
vi.mock("@/hooks/useLenoreVoice", () => ({
  useLenoreVoice: (options: typeof hooks.voice) => {
    hooks.voice = options;
    return {
      voice: voice.state,
      startVoice: vi.fn(),
      endVoice: vi.fn(),
      dismissFailure: voice.dismissFailure,
      isConnected: voice.isConnected,
      hasAgentId: false,
    };
  },
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile }));
// The orb shows what Lenore last said, and is handed the orb state; the workspace panes are not what these tests are about.
vi.mock("@/components/chamber/VoiceOrb", () => ({
  default: (props: { lastSpokenText: string; orbState: OrbState; voice: VoiceState; onTypeInstead: () => void }) => {
    hooks.orb = props;
    return <p data-testid="orb">{props.lastSpokenText}</p>;
  },
}));
vi.mock("@/components/chamber/TranscriptPanel", () => ({ default: () => null }));
vi.mock("@/components/chamber/workspace/LiveWorkspace", () => ({
  default: (props: typeof hooks.workspace) => {
    hooks.workspace = props;
    return null;
  },
}));
const extractSpoken = vi.fn();
const chatSend = vi.fn();
vi.mock("@/hooks/useLenoreChat", () => ({
  useLenoreChat: (options: typeof hooks.chat) => {
    hooks.chat = options;
    return { send: chatSend, extractSpoken, retry: vi.fn(), dismissFailure: vi.fn(), failure: null, pending: false };
  },
}));

const { default: ChamberPage } = await import("./ChamberPage");
const { voiceContextUpdate } = await import("@/data/voiceAgent");

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
    session.verifiedFields = new Set();
    session.startOver.mockReset().mockResolvedValue(true);
    auth.isAnonymous = true;
    storageWorks = true;
    mobile = false;
    voice.state = { status: "idle", attempt: 0 };
    voice.dismissFailure.mockClear();
    chatSend.mockClear();
    for (const fn of [session.startNew, session.retryLoad, session.retrySave, session.loadLatest, session.keepMine, session.discardChanges, session.restoreBackup, session.discardBackup, session.updateIntake]) {
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

  it("hands the workspace the fields an advisor verified on the intake", () => {
    session.sessionId = "s1";
    session.verifiedFields = new Set(["company_name"]);
    renderPage();
    expect(hooks.workspace?.verified).toBe(session.verifiedFields);
  });

  it("shows Lenore's latest line under the orb, not a second hello", () => {
    session.sessionId = "s1";
    session.messages = [lenore("m1", "Good evening."), prospect("m2", "We're Acme"), lenore("m3", "Acme it is. How many people?")];
    renderPage();
    expect(screen.getByTestId("orb")).toHaveTextContent("Acme it is. How many people?");
  });

  describe("merging what Lenore extracted", () => {
    const EMPTY: IntakeState = { data: EMPTY_CHAMBER_DATA, provenance: {} };
    const applied = () => (session.updateIntake.mock.calls[0][0] as (prev: IntakeState) => IntakeState)(EMPTY);
    const spoken: ChatMessage = { id: "v1", sender: "user", text: "We're about 40 people", timestamp: "", spoken: true };

    it("sends what the prospect says in a voice call through chat's extraction, the same call as a typed message (US-2.3b)", () => {
      renderPage();
      expect(hooks.voice!.onSpokenMessage).toBe(extractSpoken);
      // Calls are built from the intake as it stands, so spoken messages read one after another see each other's answers.
      expect(hooks.chat!.readIntake).toBe(session.readIntake);
    });

    it("merges a spoken message's answers as inferred at most, citing it, so they wait for the prospect to confirm (D33)", () => {
      renderPage();
      hooks.chat!.onExtracted({ employee_count: 40 }, { field_status: { employee_count: "confirmed" }, prompt_version: 4 }, { ...spoken, spoken: true });
      expect(session.updateIntake).toHaveBeenCalledTimes(1);
      const next = applied();
      expect(next.data.employee_count).toBe(40);
      expect(next.provenance.employee_count).toMatchObject({
        status: "inferred",
        source: { kind: "transcript", message_id: "v1", quote: "We're about 40 people", prompt_version: 4 },
      });
    });

    it("merges a chat extraction with its provenance", () => {
      renderPage();
      hooks.chat!.onExtracted({ employee_count: 12 }, { evidence: { employee_count: "12 staff" } }, { id: "m1", text: "We have 12 staff" });
      expect(session.updateIntake).toHaveBeenCalledTimes(1);
      expect(applied().provenance.employee_count).toMatchObject({
        status: "inferred",
        source: { kind: "transcript", message_id: "m1", quote: "12 staff" },
      });
    });
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

    describe("offline (I-3.1)", () => {
      afterEach(() => vi.restoreAllMocks());
      const goOffline = () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        window.dispatchEvent(new Event("offline"));
      };
      const goOnline = () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
        window.dispatchEvent(new Event("online"));
      };

      it("tells the prospect at once when the connection drops", () => {
        session.saveStatus = "saved";
        renderPage();
        act(goOffline);
        expect(screen.getByRole("alert")).toHaveTextContent("You're offline. Changes will save when you reconnect.");
        act(goOnline);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });

      it("saves again as soon as the connection is back, when a save failed meanwhile", () => {
        session.saveStatus = "failed";
        renderPage();
        act(goOffline);
        expect(session.retrySave).not.toHaveBeenCalled();
        act(goOnline);
        expect(session.retrySave).toHaveBeenCalledTimes(1);
      });

      it("doesn't save again on reconnecting when nothing failed", () => {
        session.saveStatus = "saved";
        renderPage();
        act(goOffline);
        act(goOnline);
        expect(session.retrySave).not.toHaveBeenCalled();
      });
    });
  });

  describe("what Lenore's voice is told", () => {
    it("is the intake update for the answers on screen, by label only (D24)", () => {
      session.chamberData = { ...EMPTY_CHAMBER_DATA, company_name: "Quill & Ink Bindery" };
      session.provenance = {};
      renderPage();
      expect(hooks.voice!.context).toBe(voiceContextUpdate(session.chamberData, session.provenance));
      expect(hooks.voice!.context).toContain("Company legal name");
      expect(hooks.voice!.context).not.toContain("Quill");
      session.chamberData = { ...EMPTY_CHAMBER_DATA };
    });
  });

  describe("voice calls in the transcript", () => {
    beforeEach(() => {
      voice.isConnected = false;
      session.addMessage.mockClear();
      session.sessionId = "s1";
    });
    const notes = () => session.addMessage.mock.calls.map(([m]) => m as ChatMessage);

    it("notes when a call starts and ends, as the Chamber's own messages", () => {
      const { rerender } = renderPage();
      expect(notes()).toEqual([]);
      voice.isConnected = true;
      rerender(<MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>);
      voice.isConnected = false;
      rerender(<MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>);
      expect(notes().map((m) => [m.sender, m.text])).toEqual([["system", "Voice call started"], ["system", "Voice call ended"]]);
      expect(notes()[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("doesn't note the end of a call in a conversation that replaced the one it was in", () => {
      const { rerender } = renderPage();
      voice.isConnected = true;
      rerender(<MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>);
      session.conversationEpoch = {};
      rerender(<MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>);
      voice.isConnected = false;
      rerender(<MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>);
      expect(notes().map((m) => m.text)).toEqual(["Voice call started"]);
    });
  });

  describe("the orb", () => {
    it("follows the text chat when no call is under way, and the call while one is", () => {
      renderPage();
      expect(hooks.orb?.orbState).toBe("idle");
      act(() => hooks.chat!.onOrbStateChange("thinking"));
      expect(hooks.orb?.orbState).toBe("thinking");

      voice.state = { status: "active", attempt: 1, speaking: true };
      act(() => hooks.chat!.onOrbStateChange("idle"));
      expect(hooks.orb?.orbState).toBe("speaking");
      expect(hooks.orb?.voice).toEqual(voice.state);
    });
  });

  describe("on a phone", () => {
    beforeEach(() => {
      mobile = true;
    });

    it("opens the whole conversation from the chat bar", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Read the conversation" }));
      expect(screen.getByRole("dialog", { name: "Conversation with Lenore" })).toBeInTheDocument();
    });

    it("continues in text after a voice failure: the notice goes and the cursor is in the input", () => {
      voice.state = { status: "failed", attempt: 1, failure: "dropped" };
      renderPage();
      act(() => hooks.orb!.onTypeInstead());
      expect(voice.dismissFailure).toHaveBeenCalledTimes(1);
      expect(screen.getByPlaceholderText("Message Lenore...")).toHaveFocus();
    });

    it("names the chat bar's input and sends from its Send button or Enter (I-2.1)", () => {
      renderPage();
      const input = screen.getByRole("textbox", { name: "Message Lenore" });
      fireEvent.change(input, { target: { value: "  We have 12 people  " } });
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      expect(chatSend).toHaveBeenCalledWith("We have 12 people");
      expect(input).toHaveValue("");
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      expect(chatSend).toHaveBeenCalledTimes(1);
      fireEvent.change(input, { target: { value: "Arizona" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(chatSend).toHaveBeenLastCalledWith("Arizona");
    });

    it("reads Lenore's replies out, since the transcript isn't on screen (I-2.2)", () => {
      session.messages = [lenore("m1", "Hello, I'm Lenore.")];
      const { rerender } = renderPage();
      session.messages = [lenore("m1", "Hello, I'm Lenore."), prospect("m2", "Hi"), lenore("m3", "How many people work for you?")];
      rerender(<MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>);
      expect(screen.getByTestId("reply-announcer")).toHaveTextContent("Lenore: How many people work for you?");
    });
  });

  it("leaves reading replies out to the transcript on a wide screen", () => {
    session.messages = [lenore("m1", "Hello, I'm Lenore.")];
    renderPage();
    expect(screen.queryByTestId("reply-announcer")).not.toBeInTheDocument();
  });

  describe("the address", () => {
    const Where = () => {
      const location = useLocation();
      return <p data-testid="where">{location.pathname + location.search}</p>;
    };
    const at = (url: string) => render(<MemoryRouter initialEntries={[url]}><ChamberPage /><Where /></MemoryRouter>);

    it("stops naming an intake once there is deliberately none on screen, so a reload doesn't try to open it", () => {
      session.sessionId = null;
      at("/start?session=archived-one");
      expect(screen.getByTestId("where")).toHaveTextContent(/^\/start$/);
    });

    it("keeps a link that is still opening, couldn't be opened, or has expired", () => {
      session.sessionId = null;
      session.isLoading = true;
      const opening = at("/start?session=linked");
      expect(screen.getByTestId("where")).toHaveTextContent("/start?session=linked");
      opening.unmount();
      session.isLoading = false;
      session.resumeFailed = true;
      const failed = at("/start?session=linked");
      expect(screen.getByTestId("where")).toHaveTextContent("/start?session=linked");
      failed.unmount();
      session.resumeFailed = false;
      session.expired = { at: null };
      at("/start?session=linked");
      expect(screen.getByTestId("where")).toHaveTextContent("/start?session=linked");
      session.expired = null;
    });
  });

  describe("ready to certify", () => {
    const ready: ChamberData = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["NY"], pay_frequency: "weekly" };
    const page = () => <MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>;
    beforeEach(() => {
      session.addMessage.mockClear();
      session.sessionId = "s1";
      session.messages = [];
      session.chamberData = { ...EMPTY_CHAMBER_DATA };
      session.provenance = {};
      session.certification = { status: "none" };
    });
    const announcements = () => session.addMessage.mock.calls.filter(([m]) => (m as ChatMessage).text === READY_MESSAGE);

    it("has Lenore say so once, when the intake becomes ready, and shows it", () => {
      const { rerender } = render(page());
      expect(screen.queryByText("Ready for your review")).not.toBeInTheDocument();
      session.chamberData = ready;
      rerender(page());
      expect(announcements()).toHaveLength(1);
      expect((announcements()[0][0] as ChatMessage).sender).toBe("lenore");
      expect(screen.getByText("Ready for your review")).toBeInTheDocument();
      // Once said (it is in the transcript), it isn't said again when readiness comes and goes.
      session.messages = [{ id: "r", sender: "lenore", text: READY_MESSAGE, timestamp: "" }];
      session.chamberData = { ...ready, pay_frequency: null };
      rerender(page());
      session.chamberData = ready;
      rerender(page());
      expect(announcements()).toHaveLength(1);
    });

    it("says nothing about an intake that was already ready when it opened", () => {
      session.chamberData = ready;
      render(page());
      expect(announcements()).toHaveLength(0);
      expect(screen.getByText("Ready for your review")).toBeInTheDocument();
    });

    it("counts a required answer in conflict as not ready", () => {
      session.chamberData = ready;
      session.provenance = { company_name: { status: "conflicting", source: { kind: "transcript", message_id: "m1" }, updated_at: "2026-11-04T00:00:00Z" } };
      render(page());
      expect(screen.queryByText("Ready for your review")).not.toBeInTheDocument();
    });
  });
});
