import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountActionsContext, type AccountActions } from "@/components/accounts/useAccountActions";
import type { OpportunityActivityRow } from "@/lib/opportunityPageApi";

// The opportunity's Activity (screen 19; D-427): an intake's own events as a kind of their own (joshrkay/Nevermore#237). The database decides which events there
// are and who sees them (supabase/tests/opportunity_activity_intake.sql); here a faked read answers and the list draws it.

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const answer = vi.fn();
vi.mock("./useOpportunityQueries", () => ({ useOpportunityActivityQuery: (...a: unknown[]) => answer(...a) }));

const { OpportunityActivity } = await import("./OpportunityActivity");

const rows: OpportunityActivityRow[] = [
  { type: "intake", entryKey: "intake_certified:c2", at: "2026-10-30T09:00:00+00:00", event: "certified", version: 2, reference: "EAA-2026-0117", invitee: null, who: "Elena Marsh", whoKind: "client" },
  { type: "intake", entryKey: "intake_invitation:v1", at: "2026-10-21T09:00:00+00:00", event: "invited", version: null, reference: null, invitee: "Elena Marsh", who: "dana@acme.example", whoKind: "member" },
  { type: "intake", entryKey: "intake_started:s1", at: "2026-10-21T08:00:00+00:00", event: "started", version: null, reference: null, invitee: null, who: "dana@acme.example", whoKind: "member" },
];

// A person who may add to and change the account's records, as the opportunity's page provides: Edit and Add to note are offered on a note, which is what makes
// "nothing is offered on an intake event" mean something here.
const actions: AccountActions = {
  canAdd: true, log: vi.fn(), edit: vi.fn(), addTo: vi.fn(), setDone: vi.fn(), addContact: vi.fn(), newOpportunity: vi.fn(), startRenewal: vi.fn(), canMove: false, move: vi.fn(),
  canMerge: false, merge: vi.fn(),
};
const note: OpportunityActivityRow = {
  type: "note", id: "n1", entryKey: "n1", at: "2026-10-29T10:00:00+00:00", who: "Dana Reyes", authorId: "u1", contact: null, opportunity: { id: "o1", name: "January 2027 PEO search" }, outcome: null,
  title: null, body: "Elena wants all three", additions: [], assignee: null, dueOn: null, doneAt: null, doneBy: null, canEdit: true, editableUntil: null,
};

const show = (data: { count: number; rows: OpportunityActivityRow[] }) => {
  answer.mockReturnValue({ query: { isError: false, isPending: false, isFetching: false, hasNextPage: false, refetch: vi.fn(), fetchNextPage: vi.fn() }, data });
  return render(
    <AccountActionsContext.Provider value={actions}>
      <OpportunityActivity firmId="f1" opportunityId="o1" />
    </AccountActionsContext.Provider>,
  );
};

afterEach(() => cleanup());

describe("OpportunityActivity: an intake's events", () => {
  // Catches: the mockup's Intake kind missing (a certification, the one thing Home's "Needs you" tracks, shows nowhere on the opportunity), or a row drawn with the
  // kind of another (a certification under Quote), the wrong day, or no one named.
  it("draws each event as an Intake row with its sentence, its day and who did it", () => {
    show({ count: 3, rows });
    const table = screen.getByRole("table", { name: "The opportunity's activity" });
    const body = within(table).getAllByRole("row").slice(1);
    expect(body).toHaveLength(3);
    for (const r of body) expect(within(r).getByText("Intake")).toBeInTheDocument();
    expect(body[0]).toHaveTextContent("Intake certified again, version 2 (EAA-2026-0117)");
    expect(body[0]).toHaveTextContent("Elena Marsh");
    expect(body[1]).toHaveTextContent("Invited Elena Marsh to fill in and certify");
    expect(body[1]).toHaveTextContent("dana@acme.example");
    expect(body[2]).toHaveTextContent("Intake started");
    expect(body[0]).toHaveTextContent("Oct 30, 2026");
  });

  // Catches: an Edit or Add to note offered on an event that is not a call, a note or a task (there is nothing to change on a certification, and the account's
  // actions are written for a call, a note or a task). The note beside them is the control: its Edit shows, so a button would show here too.
  it("offers no action on an intake event, where a note beside them has its own", () => {
    show({ count: 4, rows: [note, ...rows] });
    const table = screen.getByRole("table", { name: "The opportunity's activity" });
    const body = within(table).getAllByRole("row").slice(1);
    expect(within(body[0]).getByRole("button", { name: /Edit/ })).toBeInTheDocument();
    for (const r of body.slice(1)) expect(within(r).queryByRole("button")).toBeNull();
  });
});
