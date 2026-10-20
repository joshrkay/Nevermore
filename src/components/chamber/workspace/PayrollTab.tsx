import type { ChamberData } from "@/data/chamberTypes";
import { motion } from "framer-motion";

interface PayrollTabProps {
  data: ChamberData;
}

const GhostField = ({ label }: { label: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
    <p className="text-xs text-muted-foreground/50 italic">Lenore will fill this in...</p>
  </div>
);

const DataField = ({ label, value }: { label: string; value: string }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
    <p className="text-sm font-medium">{value}</p>
  </motion.div>
);

const PayrollTab = ({ data }: PayrollTabProps) => {
  const fields = [
    { label: "Payroll Vendor", value: data.payroll_vendor },
    { label: "Pay Frequency", value: data.pay_frequency },
    { label: "Funding Lead Time", value: data.funding_days !== null ? `${data.funding_days} days` : null },
    { label: "Nonexempt / Exempt", value: data.has_nonexempt !== null ? `${data.nonexempt_count ?? 0} nonexempt · ${data.exempt_count ?? 0} exempt` : null },
    { label: "Accrual Method", value: data.accrual_method },
  ];

  const filledCount = fields.filter(f => f.value).length + (data.pto_types.length > 0 ? 1 : 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Payroll & Time</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{filledCount} of {fields.length + 1} fields captured</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {fields.map(f =>
          f.value
            ? <DataField key={f.label} label={f.label} value={f.value} />
            : <GhostField key={f.label} label={f.label} />
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">PTO Types</p>
        {data.pto_types.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.pto_types.map(t => (
              <span key={t} className="text-[10px] bg-muted px-2 py-1 rounded-full">{t}</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">Lenore will fill this in...</p>
        )}
      </div>

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
