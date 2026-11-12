// The round-trip check for a PEO census layout (L-3.1): the census written in the layout and read back gives the same
// rows. Every PEO's layout has a test that calls this, once a real one is held (and the publish review on
// /advisor/peos runs the same check, censusRoundTrip, before a layout is published). Give it the PEO's template when
// the layout fills one.
import { expect } from "vitest";
import type { PeoCensusLayout } from "@/data/censusExport";
import { checkLayoutRoundTrip } from "@/lib/censusWorkbook";

export async function expectCensusRoundTrip(layout: PeoCensusLayout, template: Uint8Array | null = null): Promise<void> {
  expect(await checkLayoutRoundTrip(layout, template)).toEqual({ ok: true });
}
