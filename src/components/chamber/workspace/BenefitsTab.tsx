import type { ChamberData } from "@/data/chamberTypes";
import type { FieldAction, FieldKey, ProvenanceMap } from "@/data/provenance";
import { motion } from "framer-motion";
import ProvenanceField from "./ProvenanceField";

interface BenefitsTabProps {
  data: ChamberData;
  provenance?: ProvenanceMap;
  onAction?: (action: FieldAction) => void;
}

const BenefitsTab = ({ data, provenance = {}, onAction }: BenefitsTabProps) => {
  const fields: { label: string; field: FieldKey; value: string | null }[] = [
    { label: "Current Carrier", field: "current_carrier", value: data.current_carrier },
    { label: "Renewal Date", field: "renewal_date", value: data.renewal_date },
    { label: "Waiting Period", field: "benefits_waiting_period", value: data.benefits_waiting_period },
    { label: "Rate History", field: "rate_history", value: data.rate_history },
  ];

  const filledCount = fields.filter(f => f.value).length +
    (data.ancillary_benefits.length > 0 ? 1 : 0) +
    (data.has_401k !== null ? 1 : 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Benefits</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{filledCount} of 7 fields captured</span>
      </div>

      {/* Virgin / Switching header */}
      {data.virgin_medical !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-3 rounded-lg text-center font-display font-bold text-sm ${
            data.virgin_medical
              ? "bg-primary/10 border border-primary/30 text-primary"
              : "bg-secondary/10 border border-secondary/30 text-secondary"
          }`}
        >
          {data.virgin_medical ? "🩸 VIRGIN MEDICAL GROUP" : "🔄 SWITCHING COVERAGE"}
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {fields.map(f => (
          <ProvenanceField
            key={f.label}
            label={f.label}
            field={f.field}
            display={f.value}
            raw={data[f.field]}
            provenance={provenance[f.field]}
            onAction={onAction}
          />
        ))}
      </div>

      {/* Ancillary */}
      <ProvenanceField
        label="Ancillary Benefits"
        field="ancillary_benefits"
        display={data.ancillary_benefits.length > 0 ? data.ancillary_benefits.join(", ") : null}
        raw={data.ancillary_benefits}
        provenance={provenance.ancillary_benefits}
        onAction={onAction}
      >
        <div className="flex flex-wrap gap-1.5">
          {data.ancillary_benefits.map(b => (
            <span key={b} className="text-[10px] bg-muted px-2 py-1 rounded-full">{b}</span>
          ))}
        </div>
      </ProvenanceField>

      {/* 401k */}
      <ProvenanceField
        label="Retirement Plan"
        field="has_401k"
        display={
          data.has_401k === null
            ? null
            : data.has_401k
              ? `${data.retirement_type || "401k"} · ${data.employer_contributes ? "Employer contributes" : "No employer match"}`
              : "No retirement plan"
        }
        raw={data.has_401k}
        provenance={provenance.has_401k}
        onAction={onAction}
      />
    </div>
  );
};

export default BenefitsTab;
