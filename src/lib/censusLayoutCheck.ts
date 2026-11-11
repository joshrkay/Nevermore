// The check the publish review runs on a census layout (L-3.1): written on sample rows (SAMPLE_CENSUS) and read
// back, the file gives the same rows. A layout that fills the PEO's own template is checked with that template, which
// must be clean (docs/adr/0002): one still held, blocked or failed is never used, and the check says why.
import type { PeoCensusLayout } from "@/data/censusExport";
import { censusRoundTrip, SAMPLE_CENSUS } from "./censusWorkbook";
import { listCensusTemplates, readCensusTemplate, templateStatusProblem } from "./censusTemplates";

export interface CensusCheckIo {
  list: typeof listCensusTemplates;
  read: typeof readCensusTemplate;
}

const APP_IO: CensusCheckIo = { list: listCensusTemplates, read: readCensusTemplate };

/** Whether PEO `peoId`'s census layout reads back, or why not, in a sentence. */
export async function checkCensusLayout(peoId: number, layout: PeoCensusLayout, io: CensusCheckIo = APP_IO): Promise<{ ok: true } | { ok: false; message: string }> {
  let template: Uint8Array | null = null;
  if (layout.template) {
    const wanted = layout.template.id;
    const record = (await io.list(peoId)).find((t) => t.id === wanted);
    if (!record) return { ok: false, message: "The template file it names isn't one uploaded for this PEO." };
    const problem = templateStatusProblem(record.status);
    if (problem) return { ok: false, message: `${record.fileName}: ${problem}` };
    template = await io.read(peoId, wanted);
    if (!template) return { ok: false, message: `${record.fileName} couldn't be read to check it. Try again.` };
  }
  return censusRoundTrip(layout, SAMPLE_CENSUS, template);
}
