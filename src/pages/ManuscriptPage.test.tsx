import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";

let row: Record<string, unknown> | null = null;

// Stable object: the page's effect depends on `user`, as the real provider's state is stable.
const auth = { user: { id: "u1" }, loading: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
    }),
  },
}));

const { default: ManuscriptPage } = await import("./ManuscriptPage");

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ManuscriptPage />
    </MemoryRouter>,
  );

describe("ManuscriptPage", () => {
  it("refuses to certify a session that was never signed", async () => {
    row = {
      chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Acme" },
      submission: null,
      status: "in_progress",
      created_at: "2026-05-01T00:00:00Z",
    };
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText(/hasn't been signed yet/)).toBeInTheDocument();
    expect(screen.queryByText("THE MANUSCRIPT")).not.toBeInTheDocument();
  });

  it("renders the data as signed, not later edits", async () => {
    row = {
      chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Edited Later Inc" },
      submission: {
        signer_name: "Jo Doe",
        signer_title: "CEO",
        signed_at: "2026-05-01T12:00:00Z",
        file_id: "EAA-2026-ABC",
        peo: "Justworks",
        chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co" },
      },
      status: "submitted",
      created_at: "2026-05-01T00:00:00Z",
    };
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText("THE MANUSCRIPT")).toBeInTheDocument();
    expect(screen.getAllByText(/Signed Co/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Edited Later Inc/)).not.toBeInTheDocument();
    expect(screen.getByText("Justworks — Underwriting")).toBeInTheDocument();
  });
});
