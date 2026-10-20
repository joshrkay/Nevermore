import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("marks inferred and conflicting values with their source and lists them as open items", async () => {
    const at = "2026-05-01T12:00:00Z";
    row = {
      chamber_data: EMPTY_CHAMBER_DATA,
      field_provenance: {},
      submission: {
        signer_name: "Jo Doe",
        signer_title: "CEO",
        signed_at: at,
        file_id: "EAA-2026-ABC",
        chamber_data: { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co", industry: "Retail", employee_count: 40 },
        field_provenance: {
          company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: at },
          industry: { status: "inferred", source: { kind: "transcript", message_id: "m1", quote: "we sell shoes" }, updated_at: at },
          employee_count: {
            status: "conflicting",
            source: { kind: "transcript", message_id: "m1" },
            updated_at: at,
            candidates: [
              { value: 40, source: { kind: "transcript", message_id: "m1" } },
              { value: 45, source: { kind: "document", document_id: "d1", document_name: "census.csv" } },
            ],
          },
        },
      },
      status: "submitted",
      created_at: "2026-05-01T00:00:00Z",
    };
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText("THE MANUSCRIPT")).toBeInTheDocument();
    expect(screen.getByText("Entered or confirmed by the prospect")).toBeInTheDocument();
    expect(screen.getByText("From the conversation: “we sell shoes”")).toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.getByText("Conflicting")).toBeInTheDocument();
    expect(screen.getByText("Industry — please confirm")).toBeInTheDocument();
    expect(screen.getByText("Employee count — conflicting answers")).toBeInTheDocument();
  });

  it("never shows sample data on the live route when no session is given", async () => {
    renderAt("/manuscript");
    expect(await screen.findByText(/Open your Manuscript from The Reckoning/)).toBeInTheDocument();
    expect(screen.queryByText(/Meridian/)).not.toBeInTheDocument();
    expect(screen.queryByText("THE MANUSCRIPT")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to The Chamber/ })).toHaveAttribute("href", "/start");
  });

  it("renders the fictional sample only on the demo route, clearly labelled", async () => {
    render(
      <MemoryRouter initialEntries={["/manuscript/demo"]}>
        <ManuscriptPage demo />
      </MemoryRouter>,
    );
    expect(await screen.findByText("THE MANUSCRIPT")).toBeInTheDocument();
    expect(screen.getByText(/sample manuscript built from fictional data/)).toBeInTheDocument();
  });

  it("explains what to do when the session can't be found", async () => {
    row = null;
    renderAt("/manuscript?session=gone");
    expect(await screen.findByText(/couldn't find that Manuscript/)).toBeInTheDocument();
    expect(screen.getByText(/link may be out of date, or it belongs to a different account/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to The Chamber/ })).toHaveAttribute("href", "/start");
    expect(screen.queryByText("THE MANUSCRIPT")).not.toBeInTheDocument();
  });

  it("masks dates of birth by default and reveals then re-masks them with the toggle", async () => {
    const employee = {
      first_name: "Ada", last_name: "Lovelace", dob: "1990-05-17", state: "TX", title: "Engineer",
      salary: 90000, classification: "W2", dependents: [],
    };
    const data = { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co", employees: [employee] };
    row = {
      chamber_data: data,
      submission: { signer_name: "Jo", signer_title: "CEO", signed_at: "2026-05-01T12:00:00Z", file_id: "EAA-1", chamber_data: data },
      status: "submitted",
      created_at: "2026-05-01T00:00:00Z",
    };
    renderAt("/manuscript?session=s1");
    expect(await screen.findByText("••/••/1990")).toBeInTheDocument();
    expect(screen.queryByText("1990-05-17")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Data masked/ }));
    expect(screen.getByText("1990-05-17")).toBeInTheDocument();
    expect(screen.queryByText("••/••/1990")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Data visible/ }));
    expect(screen.getByText("••/••/1990")).toBeInTheDocument();
  });
});
