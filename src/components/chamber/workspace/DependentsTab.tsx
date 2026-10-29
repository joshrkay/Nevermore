import type { ChamberData } from "@/data/chamberTypes";
import { motion } from "framer-motion";
import { Users } from "lucide-react";

interface DependentsTabProps {
  data: ChamberData;
}

const DependentsTab = ({ data }: DependentsTabProps) => {
  const totalDeps = data.census.reduce((acc, e) => acc + (e.dependents?.length ?? 0), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Dependents</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{totalDeps} total dependents</span>
      </div>

      {data.census.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground/50 italic text-sm">
          Lenore will confirm dependents during conversation.
        </div>
      ) : (
        <div className="space-y-3">
          {data.census.map((emp, i) => {
            const dependents = emp.dependents ?? [];
            return (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 20) * 0.05 }}
              className="bg-muted/50 rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{emp.first_name} {emp.last_name}</span>
                <span className="text-[10px] text-muted-foreground">({dependents.length} dependent{dependents.length !== 1 ? "s" : ""})</span>
                {emp.coverage_tier && (
                  <span className="text-[10px] text-muted-foreground">· coverage tier {emp.coverage_tier}</span>
                )}
              </div>
              {dependents.length > 0 ? (
                <div className="ml-5 space-y-1">
                  {dependents.map((dep, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-muted-foreground/30">└─</span>
                      <span className="text-foreground">{dep.first_name} {dep.last_name}</span>
                      <span>|</span>
                      <span className="capitalize">{dep.relationship.replace("_", " ")}</span>
                      <span>|</span>
                      <span className="font-mono">DOB: {dep.dob}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ml-5 text-[10px] text-muted-foreground/40 italic">No dependents confirmed</p>
              )}
            </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DependentsTab;
