import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamsPage } from "@/lib/teamsApi";

// An owner's roles, teams and visibility (CRM-X1.1, BR-5.3). The database is faked at src/lib/teamsApi; what it refuses is shown in its own words.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { email: "ada@example.com" }, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const api = { loadTeamsPage: vi.fn(), changeMember: vi.fn(), saveTeam: vi.fn(), deleteTeam: vi.fn(), setFirmVisibility: vi.fn() };
vi.mock("@/lib/teamsApi", () => api);

const { RolesAndTeams } = await import("./RolesAndTeams");
const { toast } = await import("sonner");

const page = (over: Partial<TeamsPage> = {}): TeamsPage => ({
  visibility: "by_level",
  teams: [
    { id: "t1", name: "East", parentTeamId: null, parentName: null, members: 1, canDelete: false },
    { id: "t2", name: "Spare", parentTeamId: null, parentName: null, members: 0, canDelete: true },
  ],
  members: [
    { userId: "u1", email: "ada@acme.example", name: "Ada Park", role: "owner", teamId: null, teamName: null },
    { userId: "u2", email: "gus@acme.example", name: null, role: "agent", teamId: "t1", teamName: "East" },
  ],
  ...over,
});
const onChanged = vi.fn();
const show = (readOnly = false) => render(<RolesAndTeams firmId="f1" readOnly={readOnly} onChanged={onChanged} />);

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  onChanged.mockReset();
  api.loadTeamsPage.mockResolvedValue(page());
  for (const f of [api.changeMember, api.saveTeam, api.deleteTeam, api.setFirmVisibility]) f.mockResolvedValue(undefined);
});

describe("a member's role and team", () => {
  // Break caught: a role shown that isn't the member's, or a change sent for the wrong person.
  it("shows each member's role, team and what they see, and saves a change for that member alone", async () => {
    show();
    const rows = within(await screen.findByRole("list", { name: "Members' roles and teams" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Ada Park");
    expect(rows[0]).toHaveTextContent("Sees everything");
    expect(rows[1]).toHaveTextContent("gus@acme.example");
    expect(rows[1]).toHaveTextContent("Sees their own");
    expect((screen.getByLabelText("Role of gus@acme.example") as HTMLSelectElement).value).toBe("agent");
    expect((screen.getByLabelText("Team of gus@acme.example") as HTMLSelectElement).value).toBe("t1");
    const save = screen.getByRole("button", { name: "Save the role and team of gus@acme.example" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Role of gus@acme.example"), { target: { value: "lead" } });
    expect(rows[1]).toHaveTextContent("Sees their own and their teams'");
    fireEvent.click(save);
    await waitFor(() => expect(api.changeMember).toHaveBeenCalledWith("f1", "u2", "lead", "t1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("gus@acme.example is now a lead in East."));
    expect(onChanged).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.loadTeamsPage).toHaveBeenCalledTimes(2));
  });

  it("takes a member out of their team", async () => {
    show();
    fireEvent.change(await screen.findByLabelText("Team of gus@acme.example"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save the role and team of gus@acme.example" }));
    await waitFor(() => expect(api.changeMember).toHaveBeenCalledWith("f1", "u2", "agent", null));
  });

  // Break caught: the only owner's demotion shown as saved, with the choice thrown away and no word why.
  it("says a refused change in the database's words and keeps what was chosen", async () => {
    api.changeMember.mockRejectedValue(new Error("A firm keeps at least one owner. Make someone else an owner first."));
    show();
    fireEvent.change(await screen.findByLabelText("Role of Ada Park"), { target: { value: "agent" } });
    fireEvent.click(screen.getByRole("button", { name: "Save the role and team of Ada Park" }));
    expect(await screen.findByText("A firm keeps at least one owner. Make someone else an owner first.")).toBeInTheDocument();
    expect((screen.getByLabelText("Role of Ada Park") as HTMLSelectElement).value).toBe("agent");
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("the firm's teams", () => {
  it("adds a team inside another, renames one, and offers Delete only where a team can be deleted", async () => {
    show();
    const form = await screen.findByRole("form", { name: "Add a team" });
    fireEvent.change(within(form).getByLabelText("New team's name"), { target: { value: " Austin " } });
    fireEvent.change(within(form).getByLabelText("It sits in"), { target: { value: "t1" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add team" }));
    await waitFor(() => expect(api.saveTeam).toHaveBeenCalledWith("f1", { id: null, name: " Austin ", parentTeamId: "t1" }));
    await waitFor(() => expect(within(form).getByLabelText("New team's name")).toHaveValue(""));
    expect(screen.queryByRole("button", { name: "Delete East" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Name of East (1 member)"), { target: { value: "East Coast" } });
    fireEvent.click(screen.getByRole("button", { name: "Save East" }));
    await waitFor(() => expect(api.saveTeam).toHaveBeenLastCalledWith("f1", { id: "t1", name: "East Coast", parentTeamId: null }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Spare" }));
    await waitFor(() => expect(api.deleteTeam).toHaveBeenCalledWith("f1", "t2"));
  });

  // Break caught: a team offered as its own parent.
  it("never offers a team as the team it sits in", async () => {
    show();
    const choices = within(await screen.findByLabelText("East sits in")).getAllByRole("option").map((o) => o.textContent);
    expect(choices).toEqual(["No team", "Spare"]);
  });

  it("says the firm has no teams yet", async () => {
    api.loadTeamsPage.mockResolvedValue(page({ teams: [] }));
    show();
    expect(await screen.findByText("The firm has no teams yet.")).toBeInTheDocument();
  });
});

describe("who sees what", () => {
  // Break caught: the setting shown as one thing and saved as the other.
  it("shows the setting in force and saves the other when it is chosen", async () => {
    show();
    const byLevel = await screen.findByRole("radio", { name: "Each person sees their own records, a lead their teams', an owner everything" });
    expect(byLevel).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Everyone in the firm sees every record" }));
    await waitFor(() => expect(api.setFirmVisibility).toHaveBeenCalledWith("f1", "everyone"));
  });

  it("says every member sees everything when the firm is set so, whatever their role", async () => {
    api.loadTeamsPage.mockResolvedValue(page({ visibility: "everyone" }));
    show();
    const rows = within(await screen.findByRole("list", { name: "Members' roles and teams" })).getAllByRole("listitem");
    expect(rows[1]).toHaveTextContent("Sees everything");
  });
});

describe("a support session", () => {
  // ADR 0024. Break caught: support offered a control that the database refuses.
  it("reads all of it and is offered nothing to change", async () => {
    show(true);
    await screen.findByRole("list", { name: "Members' roles and teams" });
    expect(screen.queryByRole("button", { name: /Save|Delete|Add team/ })).toBeNull();
    expect(screen.getByLabelText("Role of gus@acme.example")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Everyone in the firm sees every record" })).toBeDisabled();
    expect(screen.queryByRole("form", { name: "Add a team" })).toBeNull();
  });
});
