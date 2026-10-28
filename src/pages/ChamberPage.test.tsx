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
};

// The page's own behavior is under test; the session, chat and voice hooks are stand-ins.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useChamberSession", () => ({ useChamberSession: () => session }));
vi.mock("@/hooks/useLenoreVoice", () => ({ useLenoreVoice: () => ({ startVoice: vi.fn(), isConnected: false, hasAgentId: false }) }));
vi.mock("@/hooks/useLenoreChat", () => ({ useLenoreChat: () => ({ send: vi.fn(), retry: vi.fn(), dismissFailure: vi.fn(), failure: null, pending: false }) }));

const { default: ChamberPage } = await import("./ChamberPage");

const renderPage = () => render(<MemoryRouter initialEntries={["/start"]}><ChamberPage /></MemoryRouter>);

describe("ChamberPage", () => {
  beforeEach(() => {
    session.resumeFailed = false;
    session.loadFailed = false;
    session.startNew.mockClear();
    session.retryLoad.mockClear();
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
});
