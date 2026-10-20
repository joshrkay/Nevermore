import type { ChamberData } from "@/data/chamberTypes";
import { motion } from "framer-motion";

interface CompanyTabProps {
  data: ChamberData;
  isDemo: boolean;
}

const GhostField = ({ label }: { label: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
    <p className="text-xs text-muted-foreground/50 italic">Lenore will fill this in...</p>
  </div>
);

const DataField = ({ label, value, badge }: { label: string; value: string; badge?: { text: string; color: string } }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
    <div className="flex items-center gap-2">
      <p className="text-sm font-medium">{value}</p>
      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.text}</span>
      )}
    </div>
  </motion.div>
);

const CompanyTab = ({ data, isDemo }: CompanyTabProps) => {
  const fields = [
    { label: "Business Name", value: data.company_name },
    { label: "Industry", value: data.industry },
    { label: "HQ State", value: data.hq_state },
    { label: "All States", value: data.states.length > 0 ? data.states.join(", ") : null },
    { label: "Employee Count", value: data.employee_count?.toString() },
    { label: "Target Start", value: data.start_month },
    { label: "Entity Structure", value: data.multiple_entities === null ? null : data.multiple_entities ? `Multiple (${data.fein_count} FEINs)` : "Single entity" },
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
          f.value
            ? <DataField key={f.label} label={f.label} value={f.value} />
            : <GhostField key={f.label} label={f.label} />
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
