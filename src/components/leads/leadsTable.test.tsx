import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LeadRow } from "@/lib/leadsApi";

// The leads table's Label column and filter (BR-5.4, issue 245): what the definition says of them. The database decides what a filter matches
// (supabase/tests/lead_labels_column.sql).
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, signOut: vi.fn() }) }));

const { LEADS_TABLE, leadExportColumnsFor } = await import("./leadsTable");

const row = (labels: string[]): LeadRow => ({
  id: "l1", name: "Lucia Reyes", title: null, business: null, email: null, phone: null, city: null, state: null, employees: null, current_provider: null,
  source: "added_by_hand", status: "new", not_fit_reason: null, created_at: "2026-11-01T10:00:00Z", owner: null, owner_name: null,
  last_activity_at: "2026-11-01T10:00:00Z", labels,
});

describe("the leads table's Label column", () => {
  const column = LEADS_TABLE.columns.find((c) => c.id === "labels")!;
  // The Label column reads only its row; what the page hands every cell beside it is not looked at.
  const context = undefined as never;

  // Break caught: a Label column that can't be sorted or filtered, or one put among the default columns over the story's own.
  it("is a column under Columns, sorted and filtered by the labels field, which takes a list of words", () => {
    expect(column).toMatchObject({ header: "Label", sortField: "labels", filterField: "labels" });
    expect(LEADS_TABLE.usual).not.toContain("labels");
    expect(LEADS_TABLE.fields.labels).toMatchObject({ label: "Label", kind: "choices" });
    // The firm's words are offered, never enforced: a word the firm no longer has is still a filter.
    expect(LEADS_TABLE.fields.labels.choicesEnforced).toBeUndefined();
  });

  it("shows each label as its own pill, and a dash for a lead with none", () => {
    const { unmount } = render(<>{column.cell(row(["Hot", "VIP"]), context)}</>);
    expect(screen.getByText("Hot")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(column.text?.(row(["Hot", "VIP"]), context)).toBe("Hot, VIP");
    unmount();
    render(<>{column.cell(row([]), context)}</>);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  // The export holds the columns the database has a column for; Label has none there yet, as on the accounts table.
  it("is left out of an export rather than sent as a column the database would refuse", () => {
    expect(leadExportColumnsFor([{ id: "lead", header: "Lead" }, { id: "labels", header: "Label" }], "UTC").map((c) => c.id)).toEqual(["name"]);
  });
});
