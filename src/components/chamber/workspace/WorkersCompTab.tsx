import type { ChamberData } from "@/data/chamberTypes";
import { formatAnswer } from "@/data/answerFormat";
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
    </div>
  );
};

export default WorkersCompTab;
