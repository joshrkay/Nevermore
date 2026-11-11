import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { EMPTY_PROFILE, type EditableProfile, type ProfileVersion } from "@/data/peoEditor";
import type { ProfileSource } from "@/data/peoProfiles";
import type { PeoDirectoryEntry } from "@/lib/advisorApi";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "adv@example.com" }, signOut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = {
  loadPeoDirectory: vi.fn(),
  fetchIsAdmin: vi.fn(),
  addPeo: vi.fn(),
  savePeoDraft: vi.fn(),
  publishPeoDraft: vi.fn(),
  discardPeoDraft: vi.fn(),
  recheckPeoProfile: vi.fn(),
  setPeoListed: vi.fn(),
  loadVersionContacts: vi.fn(),
};
vi.mock("@/lib/advisorApi", () => api);

const { default: AdvisorPeosPage } = await import("./AdvisorPeosPage");

const guide: ProfileSource = { kind: "document", name: "Broker guide 2026", link: "https://trinet.example/guide.pdf", checkedOn: "2026-10-20" };
const dana: ProfileSource = { kind: "person", name: "Dana Reyes", role: "Broker desk manager", checkedOn: "2026-11-03" };

const TRINET_V1: EditableProfile = {
  ...EMPTY_PROFILE,
  neededToQuote: ["company_name", "states"],
  neededBeforeSigning: ["payroll_vendor"],
  censusLayout: { peo: "TriNet", format: "xlsx", templateFile: null, columns: [{ header: "Last Name", from: "last_name" }, { header: "First Name", from: "first_name" }, { header: "SSN", from: null }] },
  documents: [{ category: "workers_comp_loss_runs", description: "Three years of loss runs" }],
  rules: { ...EMPTY_PROFILE.rules, minHeadcount: 5, statesServed: ["CA", "NY"] },
  extraQuestions: [{ key: "uses_drivers", text: "Do any employees drive for work?", kind: "yes_no" }],
  contacts: [{ name: "Dana Reyes", role: "Broker desk", email: "dana@trinet.example", phone: "555-0100" }],
  sources: { answers: dana, census_layout: guide, documents: guide, extra_questions: dana, contacts: dana, min_headcount: dana, states_served: guide },
};

const version = (n: number, profile: EditableProfile, over: Partial<ProfileVersion> = {}): ProfileVersion => ({
  id: 100 + n, version: n, revision: `rev-${n}`, status: "published", createdAt: "2026-10-01T00:00:00Z", publishedAt: `2026-11-0${n}T10:00:00Z`, profile, ...over,
});

const directory = (): PeoDirectoryEntry[] => [
  { id: 1, name: "ADP TotalSource", listed: true, versions: [] },
  { id: 2, name: "Insperity", listed: false, versions: [] },
  { id: 3, name: "Justworks", listed: true, versions: [version(1, { ...EMPTY_PROFILE, rules: { ...EMPTY_PROFILE.rules, minHeadcount: 2 }, sources: { min_headcount: { ...guide, checkedOn: "2026-03-01" } } })] },
  { id: 5, name: "TriNet", listed: true, versions: [version(2, { ...TRINET_V1, rules: { ...TRINET_V1.rules, minHeadcount: 10 } }), version(1, TRINET_V1)] },
];

const renderPage = (url = "/advisor/peos") => render(<MemoryRouter initialEntries={[url]}><AdvisorPeosPage /></MemoryRouter>);

describe("AdvisorPeosPage", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    api.loadPeoDirectory.mockResolvedValue(directory());
    api.fetchIsAdmin.mockResolvedValue(false);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 11, 12));
  });
  afterEach(() => vi.useRealTimers());

  it("lists every PEO alphabetically with one line on where its profile stands", async () => {
    renderPage();
    const list = await screen.findByRole("list", { name: "PEOs" });
    const lines = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(lines).toEqual([
      "ADP TotalSourceNo profile yet",
      "InsperityNot listed · hidden from prospects · No profile yet",
      "JustworksVersion 1 · checked 1 Mar 2026 · out of date",
      "TriNetVersion 2 · checked 20 Oct 2026",
    ]);
  });

  it("shows the chosen PEO's profile in use, section by section, each with where and when it was checked", async () => {
    renderPage("/advisor/peos?peo=5");
    const profile = await screen.findByRole("region", { name: "TriNet" });
    expect(within(profile).getByText("Version 2 in use")).toBeInTheDocument();
    expect(within(profile).getByText("Listed")).toBeInTheDocument();
    const wont = within(profile).getByRole("region", { name: "What it won't take on" });
    expect(within(wont).getByText("Minimum headcount").closest("li")).toHaveTextContent("10Broker desk: Dana Reyes, Broker desk manager · checked 3 Nov 2026");
    // A rule not checked yet has no source to show.
    expect(within(wont).getByText("Excluded industries").closest("li")?.textContent).toBe("Excluded industriesNot checked yet");
    const answers = within(profile).getByRole("region", { name: "Answers it needs" });
    expect(answers).toHaveTextContent("To quote");
    expect(answers).toHaveTextContent("Company legal name");
    expect(answers).toHaveTextContent("Only before signing");
    expect(answers).toHaveTextContent("Payroll vendor");
    const census = within(profile).getByRole("region", { name: "Census layout" });
    expect(within(census).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Last Name", "First Name", "SSN (left blank)"]);
    expect(census).toHaveTextContent("Document: Broker guide 2026 · checked 20 Oct 2026");
    expect(within(profile).getByRole("region", { name: "Documents" })).toHaveTextContent("Workers' comp loss runs");
    expect(within(profile).getByRole("region", { name: "Its own questions" })).toHaveTextContent("Do any employees drive for work?");
    expect(within(profile).getByRole("region", { name: "Contacts · advisors only" })).toHaveTextContent("dana@trinet.example");
  });

  it("is in the advisor console's navigation", async () => {
    renderPage();
    const nav = await screen.findByRole("navigation", { name: "Advisor" });
    expect(within(nav).getByRole("link", { name: "PEOs" })).toHaveAttribute("href", "/advisor/peos");
  });

  it("shows an advisor who isn't an admin the version in use, whatever an admin is drafting", async () => {
    api.loadPeoDirectory.mockResolvedValue(withDraft({ ...TRINET_V1, rules: { ...TRINET_V1.rules, minHeadcount: 12 } }));
    renderPage("/advisor/peos?peo=5");
    const wont = await screen.findByRole("region", { name: "What it won't take on" });
    expect(within(wont).getByText("Minimum headcount").closest("li")).toHaveTextContent("10");
    expect(screen.queryByText(/You have a draft/)).not.toBeInTheDocument();
  });

  it("shows an advisor who isn't an admin none of the admin's controls", async () => {
    renderPage("/advisor/peos?peo=5");
    await screen.findByRole("region", { name: "TriNet" });
    for (const name of [/Add a PEO/, /^Edit/, /Checked again/, /Take off the list/, /Review and publish/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("warns that a profile not checked in 180 days may be out of date, and still shows it", async () => {
    renderPage("/advisor/peos?peo=3");
    const profile = await screen.findByRole("region", { name: "Justworks" });
    expect(within(profile).getByText("Justworks's profile was last checked 1 Mar 2026 and may be out of date.")).toBeInTheDocument();
    expect(within(profile).getByText("Minimum headcount").closest("li")).toHaveTextContent("2");
  });

  const withDraft = (draft: EditableProfile, revision = "rev-3") =>
    directory().map((p) => (p.id === 5 ? { ...p, versions: [version(3, draft, { status: "draft", publishedAt: null, revision }), ...p.versions] } : p));

  describe("as an admin", () => {
    beforeEach(() => api.fetchIsAdmin.mockResolvedValue(true));

    it("adds a PEO, which is listed at once with no profile, and opens it", async () => {
      api.addPeo.mockResolvedValue({ id: 9 });
      renderPage();
      await screen.findByRole("list", { name: "PEOs" });
      fireEvent.click(screen.getByRole("button", { name: "Add a PEO" }));
      expect(await screen.findByText("Give the PEO's name")).toBeInTheDocument();
      expect(api.addPeo).not.toHaveBeenCalled();
      api.loadPeoDirectory.mockResolvedValue([...directory(), { id: 9, name: "Acme PEO", listed: true, versions: [] }]);
      fireEvent.change(screen.getByLabelText("Its name"), { target: { value: " Acme PEO " } });
      fireEvent.click(screen.getByRole("button", { name: "Add a PEO" }));
      await waitFor(() => expect(api.addPeo).toHaveBeenCalledWith("Acme PEO"));
      expect(await screen.findByRole("region", { name: "Acme PEO" })).toHaveTextContent("No profile yet");
    });

    it("keeps the name typed and shows the database's reason when it refuses a PEO", async () => {
      api.addPeo.mockRejectedValue(new Error("TriNet is already listed"));
      renderPage();
      await screen.findByRole("list", { name: "PEOs" });
      fireEvent.change(screen.getByLabelText("Its name"), { target: { value: "trinet" } });
      fireEvent.click(screen.getByRole("button", { name: "Add a PEO" }));
      expect(await screen.findByText("TriNet is already listed")).toBeInTheDocument();
      expect(screen.getByLabelText("Its name")).toHaveValue("trinet");
    });

    it("edits a section into a draft: the rest of the profile stays as it is in use, and the draft banner says what happens next", async () => {
      api.savePeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      const profile = await screen.findByRole("region", { name: "TriNet" });
      fireEvent.click(within(profile).getByRole("button", { name: "Edit What it won't take on" }));
      const headcount = screen.getByLabelText("Minimum headcount");
      expect(headcount).toHaveValue("10");
      fireEvent.change(headcount, { target: { value: "12" } });
      fireEvent.change(screen.getByLabelText("Checked on", { selector: "#peo-5-src-min_headcount-checked" }), { target: { value: "2026-11-10" } });
      // A rule not checked yet stays so: nothing entered, no source.
      expect(screen.getByLabelText("Excluded industries")).toHaveValue("");

      const draft = { ...TRINET_V1, rules: { ...TRINET_V1.rules, minHeadcount: 12 }, sources: { ...TRINET_V1.sources, min_headcount: { ...dana, checkedOn: "2026-11-10" } } };
      api.loadPeoDirectory.mockResolvedValue(directory().map((p) => (p.id === 5 ? { ...p, versions: [version(3, draft, { status: "draft", publishedAt: null }), ...p.versions] } : p)));
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalledWith(5, draft, { draftRevision: null, inUseVersion: 2 }));
      expect(await screen.findByText("You have a draft of version 3. Advisors and prospects keep seeing version 2 until you publish. Once published, a version can't be changed.")).toBeInTheDocument();
      expect(screen.getByRole("list", { name: "PEOs" })).toHaveTextContent("TriNetVersion 2 · checked 20 Oct 2026 · draft in progress");
    });

    it("records a rule as not checked yet, or as checked with nothing excluded, as the admin says", async () => {
      api.savePeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit What it won't take on" }));
      // States served: back to not checked yet, so it has no source.
      fireEvent.change(screen.getByLabelText("States served"), { target: { value: "" } });
      fireEvent.click(within(screen.getByRole("group", { name: "Where the states served were checked" })).getByLabelText("Not checked yet"));
      // Excluded industries: checked with the PEO, and it excludes none.
      const industries = within(screen.getByRole("group", { name: "Where the excluded industries were checked" }));
      fireEvent.click(industries.getByLabelText("A document"));
      fireEvent.change(industries.getByLabelText("Document title"), { target: { value: "Broker guide 2026" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalled());
      const [, saved] = api.savePeoDraft.mock.calls[0] as [number, EditableProfile];
      expect(saved.rules.statesServed).toBeNull();
      expect(saved.sources.states_served).toBeUndefined();
      expect(saved.rules.excludedIndustries).toEqual([]);
      expect(saved.sources.excluded_industries).toEqual({ kind: "document", name: "Broker guide 2026", checkedOn: "2026-11-11" });
    });

    it("sets a census layout back to not checked yet: the PEO gets our own layout", async () => {
      api.savePeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit Census layout" }));
      fireEvent.click(screen.getByLabelText("Not checked yet (our own layout)"));
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalled());
      const [, saved] = api.savePeoDraft.mock.calls[0] as [number, EditableProfile];
      expect(saved.censusLayout).toBeNull();
      expect(saved.sources.census_layout).toBeUndefined();
    });

    it("shows an admin their draft in the sections, while other advisors see the version in use", async () => {
      api.loadPeoDirectory.mockResolvedValue(withDraft({ ...TRINET_V1, rules: { ...TRINET_V1.rules, minHeadcount: 12 } }));
      renderPage("/advisor/peos?peo=5");
      const wont = await screen.findByRole("region", { name: "What it won't take on" });
      expect(within(wont).getByText("Minimum headcount").closest("li")).toHaveTextContent("12");
    });

    it("shows what is wrong next to the field, in plain words, and saves nothing until it is right", async () => {
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit What it won't take on" }));
      fireEvent.change(screen.getByLabelText("Minimum headcount"), { target: { value: "0" } });
      fireEvent.change(screen.getByLabelText("States served"), { target: { value: "CA, XX" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      const headcount = screen.getByLabelText("Minimum headcount");
      expect(headcount).toHaveAttribute("aria-invalid", "true");
      expect(headcount).toHaveAccessibleDescription(expect.stringContaining("A minimum headcount is a whole number of employees from 1 to 100,000"));
      expect(screen.getByLabelText("States served")).toHaveAccessibleDescription(expect.stringContaining("US state or territory codes"));
      expect(screen.getByRole("alert")).toHaveTextContent("Fix the 2 fields marked below, then save again.");
      expect(api.savePeoDraft).not.toHaveBeenCalled();
    });

    it("loses nothing typed when the save fails, and says why", async () => {
      api.savePeoDraft.mockRejectedValue(new Error("Couldn't save the draft."));
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit What it won't take on" }));
      fireEvent.change(screen.getByLabelText("Minimum headcount"), { target: { value: "15" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the draft. Nothing you typed is lost: try again.");
      expect(screen.getByLabelText("Minimum headcount")).toHaveValue("15");
    });

    it("reads each rule as it is typed: state codes in capitals, the PEO's own words one per line, a number as a number", async () => {
      api.savePeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit What it won't take on" }));
      expect(screen.getByLabelText("Minimum headcount")).toHaveAttribute("inputMode", "decimal");
      expect(screen.getByLabelText("States served")).not.toHaveAttribute("inputMode");
      fireEvent.change(screen.getByLabelText("States served"), { target: { value: "ca, ny tx" } });
      fireEvent.change(screen.getByLabelText("Excluded industries"), { target: { value: "Trucking, long haul\nRoofing" } });
      const industries = within(screen.getByRole("group", { name: "Where the excluded industries were checked" }));
      fireEvent.click(industries.getByLabelText("A document"));
      fireEvent.change(industries.getByLabelText("Document title"), { target: { value: "Broker guide 2026" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalled());
      const [, saved] = api.savePeoDraft.mock.calls[0] as [number, EditableProfile];
      expect(saved.rules.statesServed).toEqual(["CA", "NY", "TX"]);
      expect(saved.rules.excludedIndustries).toEqual(["Trucking, long haul", "Roofing"]);
    });

    it("reads a minimum left empty as not checked yet, even with a source, and says the source has nothing to be for", async () => {
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit What it won't take on" }));
      fireEvent.change(screen.getByLabelText("Minimum headcount"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      expect(within(screen.getByRole("group", { name: "Where the minimum headcount was checked" })).getByText("min headcount isn't set, so it has no source")).toBeInTheDocument();
      expect(screen.getByLabelText("Minimum headcount")).not.toHaveAttribute("aria-invalid", "true");
      expect(api.savePeoDraft).not.toHaveBeenCalled();
    });

    it("shows a problem with an answer needed only before signing in the answers' editor", async () => {
      api.loadPeoDirectory.mockResolvedValue(withDraft({ ...TRINET_V1, neededBeforeSigning: ["employees" as never] }));
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit Answers it needs" }));
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      expect(screen.getByText("employees isn't an answer the intake asks for")).toBeInTheDocument();
      expect(api.savePeoDraft).not.toHaveBeenCalled();
    });

    it("won't save over a draft that changed since the editor opened: it says so, reloads on request and keeps what was typed", async () => {
      api.loadPeoDirectory.mockResolvedValue(withDraft({ ...TRINET_V1, rules: { ...TRINET_V1.rules, minHeadcount: 12 } }));
      api.savePeoDraft.mockRejectedValueOnce(Object.assign(new Error("This draft changed since you opened it. Reload to see the latest"), { code: "PT409" }));
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit What it won't take on" }));
      fireEvent.change(screen.getByLabelText("Minimum headcount"), { target: { value: "15" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      // The save names the draft it was based on.
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalledWith(5, expect.anything(), { draftRevision: "rev-3", inUseVersion: 2 }));
      expect(await screen.findByRole("alert")).toHaveTextContent("This draft changed since you opened it. Reload to see the latest, your typing is kept.");
      expect(screen.queryByText(/try again/)).not.toBeInTheDocument();

      // Another admin's save made revision rev-4, with a new minimum enrolment.
      const newer = version(3, { ...TRINET_V1, rules: { ...TRINET_V1.rules, minHeadcount: 12, minEnrolmentPercent: 75 }, sources: { ...TRINET_V1.sources, min_enrolment_percent: dana } }, { status: "draft", publishedAt: null, revision: "rev-4" });
      api.loadPeoDirectory.mockResolvedValue(directory().map((p) => (p.id === 5 ? { ...p, versions: [newer, ...p.versions] } : p)));
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      await waitFor(() => expect(api.loadPeoDirectory).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
      expect(screen.getByLabelText("Minimum headcount")).toHaveValue("15");

      // Saved again, on top of the newer draft: its own change kept, this one added.
      api.savePeoDraft.mockResolvedValue(undefined);
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenLastCalledWith(5, expect.objectContaining({
        rules: expect.objectContaining({ minHeadcount: 15, minEnrolmentPercent: 75 }),
      }), { draftRevision: "rev-4", inUseVersion: 2 }));
    });

    it("after a reload, keeps a list as typed and takes the parts not touched from the newer draft", async () => {
      api.loadPeoDirectory.mockResolvedValue(withDraft(TRINET_V1));
      api.savePeoDraft.mockRejectedValueOnce(Object.assign(new Error("changed"), { code: "PT409" }));
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit Documents" }));
      fireEvent.click(screen.getByRole("button", { name: "Add a document" }));
      fireEvent.change(screen.getByLabelText("Document 2 kind"), { target: { value: "payroll_report" } });
      fireEvent.change(screen.getByLabelText("Document 2: what the PEO wants"), { target: { value: "Payroll register" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      // Meanwhile another admin named a person as the documents' source.
      api.loadPeoDirectory.mockResolvedValue(withDraft({ ...TRINET_V1, sources: { ...TRINET_V1.sources, documents: dana } }, "rev-4"));
      fireEvent.click(await screen.findByRole("button", { name: "Reload" }));
      await waitFor(() => expect(within(screen.getByRole("group", { name: "Where the documents were checked" })).getByLabelText("Their name")).toHaveValue("Dana Reyes"));
      expect(screen.getByLabelText("Document 2: what the PEO wants")).toHaveValue("Payroll register");
    });

    it("bases a save on the version in use when there is no draft", async () => {
      api.savePeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit Documents" }));
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalledWith(5, expect.anything(), { draftRevision: null, inUseVersion: 2 }));
    });

    it("won't publish a draft other than the one reviewed: it says so, and reloads on request", async () => {
      api.loadPeoDirectory.mockResolvedValue(withDraft({ ...TRINET_V1, rules: { ...TRINET_V1.rules, minHeadcount: 12 } }));
      api.publishPeoDraft.mockRejectedValueOnce(Object.assign(new Error("This draft changed since you opened it. Reload to see the latest"), { code: "PT409" }));
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Review and publish" }));
      const review = screen.getByRole("region", { name: "Publish version 3?" });
      fireEvent.click(within(review).getByRole("button", { name: "Publish version 3" }));
      await waitFor(() => expect(api.publishPeoDraft).toHaveBeenCalledWith(5, "rev-3"));
      expect(await within(review).findByRole("alert")).toHaveTextContent("This draft changed since you reviewed it. Reload to review the latest before you publish.");
      expect(toast.success).not.toHaveBeenCalled();

      api.loadPeoDirectory.mockResolvedValue(withDraft({ ...TRINET_V1, rules: { ...TRINET_V1.rules, minHeadcount: 14 } }, "rev-4"));
      fireEvent.click(within(review).getByRole("button", { name: "Reload" }));
      await waitFor(() => expect(within(screen.getByRole("region", { name: "Publish version 3?" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Minimum headcount: 10 → 14"]));
      expect(within(screen.getByRole("region", { name: "Publish version 3?" })).queryByRole("alert")).not.toBeInTheDocument();
      api.publishPeoDraft.mockResolvedValue(undefined);
      fireEvent.click(screen.getByRole("button", { name: "Publish version 3" }));
      await waitFor(() => expect(api.publishPeoDraft).toHaveBeenLastCalledWith(5, "rev-4"));
    });

    it("dates a part whose content changed today, which the admin can change, and keeps the date of a part left as it was", async () => {
      api.savePeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit What it won't take on" }));
      const headcountDate = () => screen.getByLabelText("Checked on", { selector: "#peo-5-src-min_headcount-checked" });
      expect(headcountDate()).toHaveValue("2026-11-03");
      fireEvent.change(screen.getByLabelText("Minimum headcount"), { target: { value: "12" } });
      expect(headcountDate()).toHaveValue("2026-11-11");
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalled());
      const [, saved] = api.savePeoDraft.mock.calls[0] as [number, EditableProfile];
      expect(saved.sources.min_headcount).toEqual({ ...dana, checkedOn: "2026-11-11" });
      expect(saved.sources.states_served).toEqual(guide);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Save to draft" })).not.toBeInTheDocument());

      // The admin sets the date themselves; it stays as they set it.
      fireEvent.click(screen.getByRole("button", { name: "Edit Documents" }));
      fireEvent.click(screen.getByRole("button", { name: "Add a document" }));
      fireEvent.change(screen.getByLabelText("Document 2 kind"), { target: { value: "payroll_report" } });
      fireEvent.change(screen.getByLabelText("Document 2: what the PEO wants"), { target: { value: "Payroll register" } });
      const documentsDate = screen.getByLabelText("Checked on", { selector: "#peo-5-src-documents-checked" });
      expect(documentsDate).toHaveValue("2026-11-11");
      fireEvent.change(documentsDate, { target: { value: "2026-11-09" } });
      fireEvent.change(screen.getByLabelText("Document 2: what the PEO wants"), { target: { value: "Last quarter's payroll register" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalledTimes(2));
      expect((api.savePeoDraft.mock.calls[1] as [number, EditableProfile])[1].sources.documents).toEqual({ ...guide, checkedOn: "2026-11-09" });
    });

    it("allows a source dated one day past the database's date (UTC), as the database does, whatever the admin's own calendar says", async () => {
      // 02:00 on 12 Nov on Kiritimati (UTC+14) is noon on 11 Nov in UTC: the database takes 12 Nov, never 13 Nov.
      const tz = process.env.TZ;
      process.env.TZ = "Pacific/Kiritimati";
      try {
        vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
        renderPage("/advisor/peos?peo=5");
        fireEvent.click(await screen.findByRole("button", { name: "Edit What it won't take on" }));
        const date = screen.getByLabelText("Checked on", { selector: "#peo-5-src-min_headcount-checked" });
        fireEvent.change(date, { target: { value: "2026-11-13" } });
        fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
        expect(date).toHaveAccessibleDescription("A source can't be checked on a date that hasn't come");
        expect(api.savePeoDraft).not.toHaveBeenCalled();
        api.savePeoDraft.mockResolvedValue(undefined);
        fireEvent.change(date, { target: { value: "2026-11-12" } });
        fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
        await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalled());
      } finally {
        process.env.TZ = tz;
      }
    });

    it("edits the answers a PEO needs, to quote and only before signing", async () => {
      api.savePeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit Answers it needs" }));
      fireEvent.change(screen.getByLabelText("Add an answer needed to quote"), { target: { value: "pay_frequency" } });
      fireEvent.click(screen.getByRole("button", { name: "Add to quote" }));
      fireEvent.click(screen.getByRole("button", { name: "Remove States of operation" }));
      // An answer already listed isn't offered again, in either list.
      const beforeSigning = screen.getByLabelText("Add an answer needed only before signing");
      expect(within(beforeSigning).queryByRole("option", { name: "Pay frequency" })).not.toBeInTheDocument();
      fireEvent.change(beforeSigning, { target: { value: "hris_system" } });
      fireEvent.click(screen.getByRole("button", { name: "Add to before signing" }));
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalledWith(5, expect.objectContaining({
        neededToQuote: ["company_name", "pay_frequency"],
        neededBeforeSigning: ["payroll_vendor", "hris_system"],
        rules: { ...TRINET_V1.rules, minHeadcount: 10 },
      }), { draftRevision: null, inUseVersion: 2 }));
    });

    it("edits the census layout in the PEO's column order, moving a column with the keyboard", async () => {
      api.savePeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit Census layout" }));
      const columns = () => screen.getAllByLabelText(/^Column \d+ header$/).map((i) => (i as HTMLInputElement).value);
      expect(columns()).toEqual(["Last Name", "First Name", "SSN"]);
      // Alt+Down on a column's header moves it down one, and keeps the cursor in it.
      const lastName = screen.getByLabelText("Column 1 header");
      lastName.focus();
      fireEvent.keyDown(lastName, { key: "ArrowDown", altKey: true });
      expect(columns()).toEqual(["First Name", "Last Name", "SSN"]);
      expect(document.activeElement).toBe(screen.getByLabelText("Column 2 header"));
      // And the buttons do the same.
      fireEvent.click(screen.getByRole("button", { name: "Move SSN up" }));
      expect(columns()).toEqual(["First Name", "SSN", "Last Name"]);
      // The cursor follows the column moved, ready to move it again.
      expect(document.activeElement).toBe(screen.getByLabelText("Column 2 header"));
      expect(screen.getByRole("button", { name: "Move First Name up" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Add a column" }));
      expect(document.activeElement).toBe(screen.getByLabelText("Column 4 header"));
      fireEvent.change(screen.getByLabelText("Column 4 header"), { target: { value: "Work State" } });
      fireEvent.change(screen.getByLabelText("Column 4 filled from"), { target: { value: "work_state" } });
      fireEvent.change(screen.getByLabelText("File"), { target: { value: "csv" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenCalledWith(5, expect.objectContaining({
        censusLayout: { peo: "TriNet", format: "csv", templateFile: null, columns: [
          { header: "First Name", from: "first_name" }, { header: "SSN", from: null }, { header: "Last Name", from: "last_name" }, { header: "Work State", from: "work_state" },
        ] },
      }), { draftRevision: null, inUseVersion: 2 }));
    });

    it("says next to a column what is wrong with it", async () => {
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit Census layout" }));
      fireEvent.change(screen.getByLabelText("Column 2 header"), { target: { value: "last name" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      expect(screen.getByLabelText("Column 2 header")).toHaveAccessibleDescription("Each census column has a header of its own");
      expect(api.savePeoDraft).not.toHaveBeenCalled();
    });

    it("edits the documents, the PEO's own questions and its contacts", async () => {
      api.savePeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Edit Documents" }));
      fireEvent.click(screen.getByRole("button", { name: "Add a document" }));
      fireEvent.change(screen.getByLabelText("Document 2 kind"), { target: { value: "payroll_report" } });
      fireEvent.change(screen.getByLabelText("Document 2: what the PEO wants"), { target: { value: "Last quarter's payroll register" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenLastCalledWith(5, expect.objectContaining({
        documents: [...TRINET_V1.documents, { category: "payroll_report", description: "Last quarter's payroll register" }],
      }), { draftRevision: null, inUseVersion: 2 }));
      await waitFor(() => expect(api.loadPeoDirectory).toHaveBeenCalledTimes(2));

      fireEvent.click(await screen.findByRole("button", { name: "Edit Its own questions" }));
      fireEvent.click(screen.getByRole("button", { name: "Add a question" }));
      fireEvent.change(screen.getByLabelText("Question 2"), { target: { value: "Which union, if any?" } });
      fireEvent.change(screen.getByLabelText("Question 2 answered as"), { target: { value: "choice" } });
      fireEvent.change(screen.getByLabelText("Question 2 choices"), { target: { value: "None\nTeamsters\n" } });
      expect(screen.getByLabelText("Question 2 key")).toHaveValue("which_union_if_any");
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenLastCalledWith(5, expect.objectContaining({
        extraQuestions: [...TRINET_V1.extraQuestions, { key: "which_union_if_any", text: "Which union, if any?", kind: "choice", choices: ["None", "Teamsters"] }],
      }), { draftRevision: null, inUseVersion: 2 }));
      await waitFor(() => expect(api.loadPeoDirectory).toHaveBeenCalledTimes(3));

      fireEvent.click(await screen.findByRole("button", { name: "Edit Contacts · advisors only" }));
      fireEvent.click(screen.getByRole("button", { name: "Remove Dana Reyes" }));
      fireEvent.click(screen.getByRole("button", { name: "Add a contact" }));
      fireEvent.change(screen.getByLabelText("Contact 1 name"), { target: { value: "Sam Lee" } });
      fireEvent.change(screen.getByLabelText("Contact 1 email"), { target: { value: "sam" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      expect(screen.getByLabelText("Contact 1 email")).toHaveAccessibleDescription("A contact's email must be an email address");
      fireEvent.change(screen.getByLabelText("Contact 1 email"), { target: { value: "sam@trinet.example" } });
      fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
      await waitFor(() => expect(api.savePeoDraft).toHaveBeenLastCalledWith(5, expect.objectContaining({
        contacts: [{ name: "Sam Lee", role: null, email: "sam@trinet.example", phone: null }],
      }), { draftRevision: null, inUseVersion: 2 }));
    });

    it("reviews what publishing the draft changes, then publishes it", async () => {
      api.loadPeoDirectory.mockResolvedValue(withDraft({ ...TRINET_V1, rules: { ...TRINET_V1.rules, minHeadcount: 12 } }));
      api.publishPeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Review and publish" }));
      const review = screen.getByRole("region", { name: "Publish version 3?" });
      expect(within(review).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Minimum headcount: 10 → 12"]);
      expect(review).toHaveTextContent("Once published, version 3 is what advisors and prospects see, and it can't be changed.");
      fireEvent.click(within(review).getByRole("button", { name: "Publish version 3" }));
      await waitFor(() => expect(api.publishPeoDraft).toHaveBeenCalledWith(5, "rev-3"));
      expect(toast.success).toHaveBeenCalledWith("Version 3 of TriNet's profile is published.");
    });

    it("won't publish a draft with a part that doesn't say where it came from, and says which", async () => {
      const draft = { ...TRINET_V1, rules: { ...TRINET_V1.rules, minEnrolmentPercent: 75 } };
      api.loadPeoDirectory.mockResolvedValue(withDraft(draft));
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Review and publish" }));
      const review = screen.getByRole("region", { name: "Publish version 3?" });
      expect(within(review).getByRole("alert")).toHaveTextContent("Name where the minimum enrolment came from, and when it was checked, before publishing");
      expect(within(review).getByRole("button", { name: "Publish version 3" })).toBeDisabled();
    });

    it("discards the draft once the admin confirms", async () => {
      api.loadPeoDirectory.mockResolvedValue(withDraft(TRINET_V1));
      api.discardPeoDraft.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Discard draft" }));
      expect(api.discardPeoDraft).not.toHaveBeenCalled();
      expect(screen.getByText("Discard your draft of version 3? What it changed is lost; version 2 stays in use.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Yes, discard it" }));
      await waitFor(() => expect(api.discardPeoDraft).toHaveBeenCalledWith(5));
    });

    it("records a re-check: the parts checked again, where and when, as a new version with nothing else changed", async () => {
      api.recheckPeoProfile.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Checked again, nothing changed" }));
      const form = screen.getByRole("region", { name: "Checked again, nothing changed" });
      // Every sourced part is offered, ticked.
      expect(within(form).getAllByRole("checkbox").map((c) => [c.getAttribute("name"), (c as HTMLInputElement).checked])).toEqual([
        ["answers", true], ["census_layout", true], ["documents", true], ["extra_questions", true], ["contacts", true], ["min_headcount", true], ["states_served", true],
      ]);
      fireEvent.click(within(form).getByLabelText("Contacts"));
      fireEvent.click(within(form).getByLabelText("A person at the PEO"));
      fireEvent.change(within(form).getByLabelText("Their name"), { target: { value: "Dana Reyes" } });
      fireEvent.change(within(form).getByLabelText("Their role"), { target: { value: "Broker desk manager" } });
      fireEvent.change(within(form).getByLabelText("Checked on"), { target: { value: "2026-11-10" } });
      fireEvent.click(within(form).getByRole("button", { name: "Record the re-check" }));
      await waitFor(() => expect(api.recheckPeoProfile).toHaveBeenCalledWith(5,
        ["answers", "census_layout", "documents", "extra_questions", "min_headcount", "states_served"],
        { kind: "person", name: "Dana Reyes", role: "Broker desk manager", checkedOn: "2026-11-10" }));
    });

    it("says next to the field what a re-check's source is missing, and records nothing", async () => {
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Checked again, nothing changed" }));
      const form = screen.getByRole("region", { name: "Checked again, nothing changed" });
      fireEvent.click(within(form).getByRole("button", { name: "Record the re-check" }));
      expect(within(form).getByLabelText("Document title")).toHaveAccessibleDescription("A source is named, by its title or the person's name, in 1 to 300 characters");
      expect(api.recheckPeoProfile).not.toHaveBeenCalled();
    });

    it("asks for the draft to be published or discarded before a re-check", async () => {
      api.loadPeoDirectory.mockResolvedValue(withDraft(TRINET_V1));
      renderPage("/advisor/peos?peo=5");
      await screen.findByRole("button", { name: "Review and publish" });
      expect(screen.getByRole("button", { name: "Checked again, nothing changed" })).toBeDisabled();
      expect(screen.getByText("Publish or discard the draft before recording a re-check.")).toBeInTheDocument();
    });

    it("takes a PEO off the list and puts it back", async () => {
      api.setPeoListed.mockResolvedValue(undefined);
      renderPage("/advisor/peos?peo=5");
      fireEvent.click(await screen.findByRole("button", { name: "Take off the list" }));
      await waitFor(() => expect(api.setPeoListed).toHaveBeenCalledWith(5, false));
      expect(toast.success).toHaveBeenCalledWith("TriNet is off the list. Prospects and advisors aren't offered it; what was sent to it still reads.");
      renderPage("/advisor/peos?peo=2");
      fireEvent.click(await screen.findByRole("button", { name: "Put back on the list" }));
      await waitFor(() => expect(api.setPeoListed).toHaveBeenCalledWith(2, true));
    });
  });

  it("shows every published version, newest first, with what each one changed", async () => {
    api.loadVersionContacts.mockResolvedValue(new Map([[102, TRINET_V1.contacts], [101, TRINET_V1.contacts]]));
    renderPage("/advisor/peos?peo=5");
    const history = await screen.findByRole("region", { name: "History" });
    fireEvent.click(within(history).getByRole("button", { name: "Show the history" }));
    await within(history).findByRole("listitem", { name: "Version 2" });
    const versions = within(history).getAllByRole("listitem", { name: /^Version/ });
    expect(versions.map((v) => v.getAttribute("aria-label"))).toEqual(["Version 2", "Version 1"]);
    expect(versions[0]).toHaveTextContent("Published 2 Nov 2026");
    expect(versions[0]).toHaveTextContent("Minimum headcount: 5 → 10");
    expect(versions[1]).toHaveTextContent("Published 1 Nov 2026");
    expect(versions[1]).toHaveTextContent("The first version");
  });

  it("closes the history when a version is published, so it is read again with the new version's contacts", async () => {
    api.fetchIsAdmin.mockResolvedValue(true);
    api.loadVersionContacts.mockResolvedValue(new Map([[102, TRINET_V1.contacts], [101, TRINET_V1.contacts]]));
    api.publishPeoDraft.mockResolvedValue(undefined);
    api.loadPeoDirectory.mockResolvedValue(withDraft(TRINET_V1));
    renderPage("/advisor/peos?peo=5");
    const history = await screen.findByRole("region", { name: "History" });
    fireEvent.click(within(history).getByRole("button", { name: "Show the history" }));
    await within(history).findByRole("listitem", { name: "Version 2" });
    api.loadPeoDirectory.mockResolvedValue(directory().map((p) => (p.id === 5 ? { ...p, versions: [version(3, TRINET_V1), ...p.versions] } : p)));
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish version 3" }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "History" })).getByRole("button", { name: "Show the history" })).toBeInTheDocument());
  });

  it("reads older versions' contacts only when the history is opened, and compares each version with its own", async () => {
    // Version 1 named nobody; only the version in use's contacts came with the page.
    api.loadVersionContacts.mockResolvedValue(new Map([[102, TRINET_V1.contacts], [101, []]]));
    renderPage("/advisor/peos?peo=5");
    const history = await screen.findByRole("region", { name: "History" });
    expect(api.loadVersionContacts).not.toHaveBeenCalled();
    fireEvent.click(within(history).getByRole("button", { name: "Show the history" }));
    await waitFor(() => expect(api.loadVersionContacts).toHaveBeenCalledWith([102, 101]));
    expect(await within(history).findByRole("listitem", { name: "Version 2" })).toHaveTextContent("Contacts: added Dana Reyes");
  });

  it("says when the history couldn't be read, and reads it again on request", async () => {
    api.loadVersionContacts.mockRejectedValueOnce(new Error("network down")).mockResolvedValue(new Map([[102, []], [101, []]]));
    renderPage("/advisor/peos?peo=5");
    const history = await screen.findByRole("region", { name: "History" });
    fireEvent.click(within(history).getByRole("button", { name: "Show the history" }));
    expect(await within(history).findByRole("alert")).toHaveTextContent("Couldn't read the history. Try again.");
    fireEvent.click(within(history).getByRole("button", { name: "Show the history" }));
    expect(await within(history).findByRole("listitem", { name: "Version 1" })).toBeInTheDocument();
  });
});
