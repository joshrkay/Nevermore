import type { ChamberData } from "@/data/chamberTypes";
import type { FieldAction, FieldKey, ProvenanceMap } from "@/data/provenance";
import ProvenanceField from "./ProvenanceField";

interface PayrollTabProps {
  data: ChamberData;
  provenance?: ProvenanceMap;
  onAction?: (action: FieldAction) => void;
}

const PayrollTab = ({ data, provenance = {}, onAction }: PayrollTabProps) => {
  const fields: { label: string; field: FieldKey; value: string | null; editable?: boolean }[] = [
    { label: "Payroll Vendor", field: "payroll_vendor", value: data.payroll_vendor },
    { label: "Pay Frequency", field: "pay_frequency", value: data.pay_frequency },
    { label: "Funding Lead Time", field: "funding_days", value: data.funding_days !== null ? `${data.funding_days} days` : null },
    { label: "Nonexempt / Exempt", field: "has_nonexempt", value: data.has_nonexempt !== null ? `${data.nonexempt_count ?? 0} nonexempt · ${data.exempt_count ?? 0} exempt` : null, editable: false },
    { label: "Accrual Method", field: "accrual_method", value: data.accrual_method },
  ];

  const filledCount = fields.filter(f => f.value).length + (data.pto_types.length > 0 ? 1 : 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Payroll & Time</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{filledCount} of {fields.length + 1} fields captured</span>
      </div>

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
            editable={f.editable}
          />
        ))}
      </div>

      <ProvenanceField
        label="PTO Types"
        field="pto_types"
        display={data.pto_types.length > 0 ? data.pto_types.join(", ") : null}
        raw={data.pto_types}
        provenance={provenance.pto_types}
        onAction={onAction}
      >
        <div className="flex flex-wrap gap-1.5">
          {data.pto_types.map(t => (
            <span key={t} className="text-[10px] bg-muted px-2 py-1 rounded-full">{t}</span>
          ))}
        </div>
      </ProvenanceField>

      {/* TLM Method */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Time & Labor Method</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: "Computer", value: data.uses_computer_timekeeping },
            { label: "Mobile App", value: data.uses_mobile_app },
            { label: "Physical Clock", value: data.uses_physical_clocks },
          ].map(m => (
            <span
              key={m.label}
              className={`px-2 py-1 rounded-full ${
                m.value === true ? "bg-success/15 text-success" : m.value === false ? "bg-muted text-muted-foreground/40" : "bg-muted text-muted-foreground/40"
              }`}
            >
              {m.value === true ? "✓ " : ""}{m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PayrollTab;
