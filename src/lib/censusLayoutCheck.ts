// The check the publish review runs on a census layout (L-3.1): written on sample rows (SAMPLE_CENSUS) and read
// back, the file gives the same rows. A layout that fills the PEO's own template is checked with that template, which
// must be clean (docs/adr/0002): one still held, blocked or failed is never used, and the check says why.
import type { PeoCensusLayout } from "@/data/censusExport";
import { checkLayoutRoundTrip } from "./censusWorkbook";
import { listTemplateWorkbooks, readTemplateWorkbook, templateWorkbookProblem } from "./templateWorkbooks";

export interface CensusCheckIo {
  list: typeof listTemplateWorkbooks;
  read: typeof readTemplateWorkbook;
}

const APP_IO: CensusCheckIo = { list: listTemplateWorkbooks, read: readTemplateWorkbook };

/** Whether PEO `peoId`'s census layout reads back, or why not, in a sentence. */
export async function checkCensusLayout(peoId: number, layout: PeoCensusLayout, io: CensusCheckIo = APP_IO): Promise<{ ok: true } | { ok: false; message: string }> {
  let template: Uint8Array | null = null;
  if (layout.template) {
    const wanted = layout.template.id;
    const record = (await io.list(peoId)).find((t) => t.id === wanted);
    if (!record) return { ok: false, message: "The template workbook it names isn't one uploaded for this PEO." };
    const problem = templateWorkbookProblem(record.status);
    if (problem) return { ok: false, message: `${record.fileName}: ${problem}` };
    template = await io.read(peoId, wanted);
    if (!template) return { ok: false, message: `${record.fileName} couldn't be read to check it. Try again.` };
  }
  return checkLayoutRoundTrip(layout, template);
}
