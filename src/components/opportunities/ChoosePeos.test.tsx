import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PeoRecord } from "@/data/peoCatalog";
import type { useStillNeeds } from "./useStillNeeds";

// Seam 2 (D-13): Choose PEOs on the opportunity's quotes panel (D-1727). The component it opens is faked, so this is only what Choose PEOs itself decides:
// when to show the panel, and what to say until it can.
vi.mock("@/components/advisor/SendToSeveralPeos", () => ({
  default: (p: { catalog: readonly PeoRecord[]; openLabel?: string }) => <div data-testid="panel" data-peos={p.catalog.map((x) => x.name).join(",")}>{p.openLabel}</div>,
}));

const { ChoosePeos } = await import("./ChoosePeos");

type Needs = ReturnType<typeof useStillNeeds>;
const peo = (name: string) => ({ id: 1, name, listed: true, profile: null }) as unknown as PeoRecord;
const certified = { intake: { data: { company_name: "Reyes Bakery" } }, documents: [], version: 1, changedSince: false, cantTell: false } as unknown as NonNullable<Needs["certified"]>;
const detail = { id: "s1", fileId: "EAA-2026-0001", submission: { file_id: "EAA-2026-0001" } } as unknown as NonNullable<Needs["detail"]>;
const needs = (over: Partial<Needs>): Needs => ({ status: "ready", of: () => "Nothing", retry: vi.fn(), messages: [], detail, certified, catalog: [], ...over }) as Needs;
const props = { onChoose: vi.fn(), returnTo: "/opportunities/o1", onSent: vi.fn() };

describe("ChoosePeos", () => {
  // Catches (issue #236): the panel drawn as soon as the submission is read, while the PEO catalog is still loading, so a broker is shown "no PEO can be chosen"
  // (or an empty list, with none ticked by default) for a moment before the PEOs arrive.
  it("shows nothing of the panel until the submission and the PEOs have both been read, and says it is loading", () => {
    const { rerender } = render(<ChoosePeos {...props} needs={needs({ status: "ready", detail: undefined, certified: null })} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose PEOs" }));
    expect(props.onChoose).toHaveBeenCalledTimes(1);

    rerender(<ChoosePeos {...props} needs={needs({ status: "loading", catalog: [] })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the PEOs");
    expect(screen.queryByTestId("panel")).not.toBeInTheDocument();

    rerender(<ChoosePeos {...props} needs={needs({ status: "ready", catalog: [peo("Justworks"), peo("TriNet")] })} />);
    expect(screen.getByTestId("panel")).toHaveAttribute("data-peos", "Justworks,TriNet");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // Catches: a read that failed turned into a loading message that never goes away.
  it("says a failed read failed, with Try again, and not that it is loading", () => {
    const retry = vi.fn();
    render(<ChoosePeos {...props} needs={needs({ status: "failed", retry })} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose PEOs" }));
    expect(screen.getByRole("alert")).toHaveTextContent("PEOs can't be chosen yet");
    expect(screen.queryByText(/Loading the PEOs/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
