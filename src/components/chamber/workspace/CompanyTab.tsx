import type { ChamberData } from "@/data/chamberTypes";
import type { FieldAction, FieldKey, ProvenanceMap } from "@/data/provenance";
import { motion } from "framer-motion";
import ProvenanceField from "./ProvenanceField";

interface CompanyTabProps {
  data: ChamberData;
  isDemo: boolean;
  provenance?: ProvenanceMap;
  onAction?: (action: FieldAction) => void;
}

const CompanyTab = ({ data, isDemo, provenance = {}, onAction }: CompanyTabProps) => {
  const fields: { label: string; field: FieldKey; value: string | null | undefined }[] = [
    { label: "Business Name", field: "company_name", value: data.company_name },
    { label: "Industry", field: "industry", value: data.industry },
    { label: "HQ State", field: "hq_state", value: data.hq_state },
    { label: "All States", field: "states", value: data.states.length > 0 ? data.states.join(", ") : null },
    { label: "Employee Count", field: "employee_count", value: data.employee_count?.toString() },
    { label: "Target Start", field: "start_month", value: data.start_month },
    { label: "Entity Structure", field: "multiple_entities", value: data.multiple_entities === null ? null : data.multiple_entities ? `Multiple (${data.fein_count ?? "?"} FEINs)` : "Single entity" },
  ];

  const filledCount = fields.filter(f => f.value).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Company Profile</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{filledCount} of {fields.length} fields captured</span>
      </div>

      {isDemo && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="text-4xl font-display font-bold text-muted-foreground/10 rotate-[-15deg]">DEMO DATA</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {fields.map(f => (
          <ProvenanceField
            key={f.label}
            label={f.label}
            field={f.field}
            display={f.value || null}
            raw={data[f.field]}
            provenance={provenance[f.field]}
            onAction={isDemo ? undefined : onAction}
          />
        ))}
      </div>

      {/* Virgin medical badge */}
      {data.virgin_medical !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mt-4 p-3 rounded-lg border text-center ${
            data.virgin_medical
              ? "border-primary/40 bg-primary/10"
              : "border-secondary/40 bg-secondary/10"
          }`}
        >
          <span className="text-sm font-display font-bold">
            {data.virgin_medical ? "🩸 VIRGIN MEDICAL GROUP" : "🔄 SWITCHING COVERAGE"}
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default CompanyTab;
