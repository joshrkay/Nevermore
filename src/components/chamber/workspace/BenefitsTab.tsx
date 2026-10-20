import type { ChamberData } from "@/data/chamberTypes";
import { motion } from "framer-motion";

interface BenefitsTabProps {
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

const BenefitsTab = ({ data }: BenefitsTabProps) => {
  const fields = [
    { label: "Current Carrier", value: data.current_carrier },
    { label: "Renewal Date", value: data.renewal_date },
    { label: "Waiting Period", value: data.benefits_waiting_period },
    { label: "Rate History", value: data.rate_history },
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
        {fields.map(f =>
          f.value
            ? <DataField key={f.label} label={f.label} value={f.value} />
            : <GhostField key={f.label} label={f.label} />
        )}
      </div>

      {/* Ancillary */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Ancillary Benefits</p>
        {data.ancillary_benefits.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.ancillary_benefits.map(b => (
              <span key={b} className="text-[10px] bg-muted px-2 py-1 rounded-full">{b}</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">Lenore will fill this in...</p>
        )}
      </div>

      {/* 401k */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Retirement Plan</p>
        {data.has_401k !== null ? (
          <p className="text-sm font-medium">
            {data.has_401k
              ? `${data.retirement_type || "401k"} · ${data.employer_contributes ? "Employer contributes" : "No employer match"}`
              : "No retirement plan"}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">Lenore will fill this in...</p>
        )}
      </div>
    </div>
  );
};

export default BenefitsTab;
