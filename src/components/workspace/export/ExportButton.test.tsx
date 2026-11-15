import { useLayoutEffect, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Which screen a finished export belongs to (story CRM-S3.8a; docs/BROKER_CRM_BUILD.md D-245). The pages' own tests (AdvisorPartnersPage.export.test.tsx,
// AdvisorActivityPage.export.test.tsx) cover the firm being changed through the page; this covers every other way the screen can stop being the one
// the export was asked from, including those no page reaches today (another table, other columns), with the button given its props directly.
let signedIn: { id: string } | null = { id: "u1" };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: signedIn, signOut: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const exportTable = vi.fn();
vi.mock("@/lib/exportApi", async () => ({ ...(await vi.importActual<object>("@/lib/exportApi")), exportTable: (...args: unknown[]) => exportTable(...args) }));

const { ExportButton } = await import("./ExportButton");
const { WorkspaceContext } = await import("@/components/workspace/workspaceContext");

const NOT_SAVED = "An export you started finished after the page changed, so its file was not saved.";
const noun = { singular: "referral partner", plural: "referral partners" };
const partners = {
  firmId: "firm-a",
  table: "referral_partners" as const,
  columns: [{ column: "name" as const, header: "Partner" }, { column: "code" as const, header: "Their code" }],
  filters: [{ field: "kind", op: "any_of", value: ["law_firm"] }],
  fileName: "referral-partners",
  noun,
};
const activity = {
  firmId: "firm-a",
  table: "firm_activity" as const,
  columns: [{ column: "at" as const, header: "When" }, { column: "who" as const, header: "Who" }],
  filters: [{ field: "kind", op: "any_of", value: ["law_firm"] }],
  fileName: "who-did-what",
  noun: { singular: "entry", plural: "entries" },
};
const workspace = (isSupport: boolean) => ({
  firm: { id: "firm-a", name: "Alpha", address: "alpha" }, role: isSupport ? ("Nevermore support" as const) : ("Owner" as const), isOwner: !isSupport, isSupport,
  supportEndsAt: null, supportSessionId: null, isPlatformAdmin: false, person: "owner@example.com",
});
const inWorkspace = (isSupport: boolean, child: React.ReactNode) => <WorkspaceContext.Provider value={workspace(isSupport)}>{child}</WorkspaceContext.Provider>;

let saved: string[] = [];
let arrive: (v: unknown) => void = () => undefined;
const answer = { table: "referral_partners", columns: ["name", "code"], rows: [["Bay Law", "bay-law"]], rowCount: 1, wholeTable: false, exportedAt: "2026-03-02T12:00:00.000Z" };

const pressed = async (ui: React.ReactElement) => {
  const view = render(ui);
  await userEvent.setup().click(screen.getByRole("button", { name: "Export" }));
  expect(exportTable).toHaveBeenCalledTimes(1);
  return view;
};
/** Waits until the export has been dealt with, saved or not, and says it was not saved: a file that was saved shows as one, not as a toast that never came. */
const toldNotSaved = async () => {
  await waitFor(() => expect(saved.length + vi.mocked(toast.message).mock.calls.length).toBeGreaterThan(0));
  expect(saved).toHaveLength(0);
  expect(toast.message).toHaveBeenCalledTimes(1);
  expect(toast.message).toHaveBeenCalledWith(NOT_SAVED);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
};
const notSaved = async () => {
  arrive(answer);
  await toldNotSaved();
};
/** A button that is still on the page after the export it was pressed for went stale is as it was before the press: not "Exporting…", nothing said under it. */
const asBeforeThePress = () => {
  expect(screen.getByRole("button", { name: "Export" })).not.toHaveAttribute("aria-disabled");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
};

describe("ExportButton: the screen an export belongs to", () => {
  beforeEach(() => {
    signedIn = { id: "u1" };
    saved = [];
    exportTable.mockReset();
    exportTable.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    vi.mocked(toast.message).mockReset();
    URL.createObjectURL = vi.fn(() => "blob:csv");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { saved.push(this.download); });
  });
  afterEach(() => vi.restoreAllMocks());

  // Catches: the file saved when the export finishes, whatever has happened to the screen since it was asked. The file's name says nothing of the
  // firm or the filters (D-235), so a file that arrives on another screen is taken for that screen's. Each case is one way the screen can change.
  it("saves the file when nothing has changed, though the page drew the button again with the same filters and columns in new arrays", async () => {
    const view = await pressed(<ExportButton {...partners} />);
    view.rerender(<ExportButton {...partners} filters={[{ field: "kind", op: "any_of", value: ["law_firm"] }]} columns={[...partners.columns]} />);
    arrive(answer);
    await waitFor(() => expect(saved).toEqual(["referral-partners-2026-03-02.csv"]));
    expect(toast.message).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Exported 1 referral partner.");
  });

  it("saves nothing, and says so, when the button has gone from the page (another page, another firm's page, the sign-in screen)", async () => {
    const view = await pressed(<ExportButton {...partners} />);
    view.unmount();
    await notSaved();
  });

  it("saves nothing when the firm changed", async () => {
    const view = await pressed(<ExportButton {...partners} />);
    view.rerender(<ExportButton {...partners} firmId="firm-b" />);
    await notSaved();
    asBeforeThePress();
  });

  it("saves nothing when the table changed, even asking for a column both tables have", async () => {
    const kind = { column: "kind" as const, header: "Kind" };
    const view = await pressed(<ExportButton {...partners} columns={[kind]} />);
    view.rerender(<ExportButton {...activity} columns={[kind]} />);
    await notSaved();
  });

  it("saves nothing when the filters changed, since the file would not be what the page now shows", async () => {
    const view = await pressed(<ExportButton {...partners} />);
    view.rerender(<ExportButton {...partners} filters={[{ field: "kind", op: "any_of", value: ["accounting"] }]} />);
    await notSaved();
    asBeforeThePress();
  });

  it("saves nothing when the columns changed", async () => {
    const view = await pressed(<ExportButton {...partners} />);
    view.rerender(<ExportButton {...partners} columns={[partners.columns[1], partners.columns[0]]} />);
    await notSaved();
  });

  it("saves nothing when the person has signed out, whatever is left on screen", async () => {
    const view = await pressed(<ExportButton {...partners} />);
    signedIn = null;
    view.rerender(<ExportButton {...partners} />);
    await notSaved();
  });

  it("saves nothing when the person has become another one", async () => {
    const view = await pressed(<ExportButton {...partners} />);
    signedIn = { id: "u2" };
    view.rerender(<ExportButton {...partners} />);
    await notSaved();
  });

  it("saves nothing when Nevermore support has begun, when downloads are off", async () => {
    const view = await pressed(inWorkspace(false, <ExportButton {...partners} />));
    view.rerender(inWorkspace(true, <ExportButton {...partners} />));
    await notSaved();
  });

  // Catches: the file saved because the screen is the same at the end as it was at the start, though it was another one in between (D-250). The comparison
  // of the screen at the end proves only that it came back, not that it never changed: a support session that began and ended, or a filter put back, is a
  // change the person made and the export was not asked on. Each case changes one part of the screen and puts it back before the database answers.
  const awayAndBack: [string, () => React.ReactElement, () => React.ReactElement, () => React.ReactElement][] = [
    ["the firm", () => <ExportButton {...partners} />, () => <ExportButton {...partners} firmId="firm-b" />, () => <ExportButton {...partners} />],
    [
      "the filters",
      () => <ExportButton {...partners} />,
      () => <ExportButton {...partners} filters={[{ field: "kind", op: "any_of", value: ["accounting"] }]} />,
      () => <ExportButton {...partners} filters={[{ field: "kind", op: "any_of", value: ["law_firm"] }]} />,
    ],
    [
      "the columns",
      () => <ExportButton {...partners} />,
      () => <ExportButton {...partners} columns={[partners.columns[1], partners.columns[0]]} />,
      () => <ExportButton {...partners} columns={[...partners.columns]} />,
    ],
    [
      "the person",
      () => <ExportButton {...partners} />,
      () => { signedIn = { id: "u2" }; return <ExportButton {...partners} />; },
      () => { signedIn = { id: "u1" }; return <ExportButton {...partners} />; },
    ],
    [
      "whether downloads are off (Nevermore support begun and ended)",
      () => inWorkspace(false, <ExportButton {...partners} />),
      () => inWorkspace(true, <ExportButton {...partners} />),
      () => inWorkspace(false, <ExportButton {...partners} />),
    ],
  ];
  it.each(awayAndBack)("saves nothing when %s changed and changed back before the database answered", async (_part, start, away, back) => {
    const view = await pressed(start());
    view.rerender(away());
    view.rerender(back());
    await notSaved();
    asBeforeThePress();
  });

  // Catches: the screen's change known to the button only when React runs the effects that are not layout effects, which it does after the page is drawn
  // (D-251). For a change that no event of the person's made (an answer, a session that ended, support begun) React draws the page and leaves those effects
  // to a later turn, so a database answer that comes between the two would be taken for one that came before the change, and its file saved to a screen it was
  // not asked on. The tests above flush every effect before they answer. This one answers when the page has been drawn and nothing else has run, the way a
  // browser that took long over the drawing does (React hands the rest of its work on after about 5 ms): the answer is waiting, and is read in that gap.
  const takeLong = () => { for (const until = performance.now() + 20; performance.now() < until; ) { /* a page that took long to draw */ } };
  let change: (to: { firmId?: string; shown?: boolean }) => void = () => undefined;
  let whenDrawn: () => void = () => undefined;
  const Page = () => {
    const [on, setOn] = useState({ firmId: "firm-a", shown: true });
    change = (to) => setOn((now) => ({ ...now, ...to }));
    useLayoutEffect(() => whenDrawn());
    return on.shown ? <ExportButton {...partners} firmId={on.firmId} /> : null;
  };
  it.each([
    ["the firm changed", { firmId: "firm-b" }],
    ["the button went from the page", { shown: false }],
  ])("saves nothing when %s and the database answers as the page is drawn, before its effects have run", async (_what, to) => {
    await pressed(<Page />);
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const wasActing = env.IS_REACT_ACT_ENVIRONMENT;
    const windowEvent = Object.getOwnPropertyDescriptor(window, "event");
    // Outside `act`, React draws as it does in a browser: this update is nobody's event, and it is drawn on its own turn.
    env.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      whenDrawn = () => { whenDrawn = () => undefined; arrive(answer); takeLong(); };
      // jsdom leaves the click on `window.event` after the press, and React takes an update made while one is there for the person's own (drawn at once,
      // effects and all); a browser does not, and an answer is not a click.
      Object.defineProperty(window, "event", { get: () => undefined, configurable: true });
      change(to);
      await toldNotSaved();
    } finally {
      env.IS_REACT_ACT_ENVIRONMENT = wasActing;
      if (windowEvent) Object.defineProperty(window, "event", windowEvent);
    }
  });

  // Catches: a refusal that arrives after the person has gone drawn as an alert (with a "Sign in again" or "Try again" that belongs to a screen they have
  // left) under whatever the button is now beside.
  it("says nothing of a refusal that arrives after the person has gone, whether the button is still there or not", async () => {
    const { ExportRefusal } = await import("@/lib/exportApi");
    let refuse: (e: Error) => void = () => undefined;
    exportTable.mockReset();
    exportTable.mockReturnValue(new Promise((_, reject) => { refuse = reject; }));
    const view = await pressed(<ExportButton {...partners} />);
    view.rerender(<ExportButton {...partners} firmId="firm-b" />);
    refuse(new ExportRefusal("Sign in again to export the whole table.", "sign_in_again"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Export" })).not.toHaveAttribute("aria-disabled"));
    asBeforeThePress();
    view.unmount();
    expect(toast.message).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });
});
