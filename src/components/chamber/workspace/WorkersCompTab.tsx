import type { ChamberData } from "@/data/chamberTypes";
import { formatAnswer } from "@/data/answerFormat";
import { CLASS_CODE_PAYROLL_COLUMNS, classCodePayroll, classCodePayrollCells } from "@/data/classCodePayroll";
import { isEmpty, type FieldAction, type FieldKey, type ProvenanceMap } from "@/data/provenance";
import ProvenanceField from "./ProvenanceField";
import RowsField from "./RowsField";

interface WorkersCompTabProps {
  data: ChamberData;
  isDemo: boolean;
  provenance?: ProvenanceMap;
  onAction?: (action: FieldAction) => void;
}

const ANSWERS: { label: string; field: FieldKey }[] = [
  { label: "Workers' Comp Carrier", field: "wc_carrier" },
  { label: "Renewal Date", field: "wc_renewal_date" },
  { label: "Experience Mod", field: "wc_experience_mod" },
  { label: "Annual Premium", field: "wc_annual_premium" },
];

/**
 * What a workers' comp underwriter asks for: the current policy's answers, and the tables Lenore doesn't ask for
 * row by row (the owners and officers, K-3.1). The prospect types a table here, or adds to what Lenore heard.
 */
const WorkersCompTab = ({ data, isDemo, provenance = {}, onAction }: WorkersCompTabProps) => {
  const act = isDemo ? undefined : onAction;
  const payroll = classCodePayroll(data.census);
  return (
    <div className="p-4 space-y-6">
      <h3 className="font-display text-lg font-bold">Workers' Comp</h3>

      <div className="grid grid-cols-2 gap-4">
        {ANSWERS.map(({ label, field }) => (
          <ProvenanceField
            key={field}
            label={label}
            field={field}
            display={isEmpty(data[field]) ? null : field === "wc_annual_premium" ? `$${Number(data[field]).toLocaleString("en-US")}` : formatAnswer(field, data[field])}
            raw={data[field]}
            provenance={provenance[field]}
            onAction={act}
          />
        ))}
      </div>

      <RowsField
        field="owners_officers"
        rows={data.owners_officers}
        provenance={provenance.owners_officers}
        onAction={act}
        hint="List each owner and officer, with their share of the business and whether workers' comp covers them."
      />

      <RowsField
        field="loss_history"
        rows={data.loss_history}
        provenance={provenance.loss_history}
        onAction={act}
        hint="Up to five policy years: carrier, premium, experience mod, claims, paid and reserved. A loss run you upload can fill a year in."
      />

      {/* Worked out from the census, never typed (K-3.2). */}
      <section className="space-y-2">
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Payroll by class code and state</h4>
        {payroll.length === 0 ? (
          <p className="text-xs text-muted-foreground">Upload a census and this table fills itself in: payroll and headcount for each workers' comp class code in each state.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table aria-label="Payroll by class code and state" className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    {CLASS_CODE_PAYROLL_COLUMNS.map((c) => <th key={c} className="font-normal pr-3 pb-1">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((row) => (
                    <tr key={`${row.state}|${row.classCode}`} className="border-t border-border/50">
                      {classCodePayrollCells(row).map((cell, i) => <td key={i} className="pr-3 py-1 font-medium">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">Worked out from your census, for employees only. It changes only when your census does.</p>
          </>
        )}
      </section>
    </div>
  );
};

export default WorkersCompTab;
