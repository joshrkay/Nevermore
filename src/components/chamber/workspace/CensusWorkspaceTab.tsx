import type { ChamberData } from "@/data/chamberTypes";
import { motion } from "framer-motion";

interface CensusWorkspaceTabProps {
  data: ChamberData;
  isDemo: boolean;
}

const CensusWorkspaceTab = ({ data, isDemo }: CensusWorkspaceTabProps) => {
  const { employees } = data;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Employee Census</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{employees.length} employees</span>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground/50 italic text-sm">
          Lenore will build the roster as you talk...
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">#</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">State</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Title</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Salary</th>
                <th className="text-center px-3 py-2 text-muted-foreground font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <motion.tr
                  key={`${emp.first_name}-${emp.last_name}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{emp.first_name} {emp.last_name}</td>
                  <td className="px-3 py-2 font-mono">{emp.state}</td>
                  <td className="px-3 py-2">{emp.title}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {emp.salary ? `$${emp.salary.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      emp.classification === "1099"
                        ? "bg-warning/15 text-warning"
                        : "bg-secondary/15 text-secondary"
                    }`}>
                      {emp.classification}
                    </span>
                    {emp.classification === "1099" && emp.state === "CA" && (
                      <span className="ml-1 text-[9px] text-warning">⚠ AB5</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CensusWorkspaceTab;
