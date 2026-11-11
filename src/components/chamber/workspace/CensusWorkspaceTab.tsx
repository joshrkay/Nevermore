import type { CensusEmployee, ChamberData } from "@/data/chamberTypes";
import { censusAge, censusGaps, censusPay, classificationLabel, isAssumed } from "@/data/census";
import { motion } from "framer-motion";
import type { FieldAction, ProvenanceMap } from "@/data/provenance";
import ProvenanceField from "./ProvenanceField";

interface CensusWorkspaceTabProps {
  data: ChamberData;
  isDemo: boolean;
  /** The census's field status and source (US-2.2a), shown with Confirm. */
  provenance?: ProvenanceMap;
  onAction?: (action: FieldAction) => void;
}

/** Where and how someone works (K-2.2): "Oakland warehouse · travels", "Remote", or a dash when the census doesn't say. */
const worksiteCell = (emp: CensusEmployee): string => {
  const how = [emp.remote ? "remote" : "", emp.travels ? "travels" : ""].filter(Boolean).join(" · ");
  if (emp.worksite) return how ? `${emp.worksite} · ${how}` : emp.worksite;
  return how ? how.replace(/^./, (c) => c.toUpperCase()) : "—";
};

const CensusWorkspaceTab = ({ data, isDemo, provenance = {}, onAction }: CensusWorkspaceTabProps) => {
  const { census } = data;
  const withGaps = census.filter((e) => censusGaps(e).length > 0).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Employee Census</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{census.length} employees</span>
      </div>

      {census.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Upload a census on the Upload tab, where you can download a template to fill in with one row per employee. The roster comes only from a file, so Lenore won't ask for it person by person.
        </div>
      ) : (
        <>
          {/* Where the roster came from and whether it is confirmed, as for every other answer. */}
          <ProvenanceField
            label="Census"
            field="census"
            display={`${census.length} ${census.length === 1 ? "person" : "people"}`}
            raw={census}
            provenance={provenance.census}
            onAction={isDemo ? undefined : onAction}
            editable={false}
            required={false}
          />
          {withGaps > 0 && (
            <p className="text-xs text-warning">
              {withGaps} {withGaps === 1 ? "row is" : "rows are"} missing an underwriting detail (age, work state, title or
              salary). Underwriters will ask for it.
            </p>
          )}
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">#</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Age</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">State</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Worksite</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Title</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Pay</th>
                  <th className="text-center px-3 py-2 text-muted-foreground font-medium">Type</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Gender</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Hired</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Home</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Tier</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">COBRA</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">WC code</th>
                </tr>
              </thead>
              <tbody>
                {census.map((emp, i) => {
                  const gaps = censusGaps(emp);
                  return (
                    <motion.tr
                      key={emp.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 20) * 0.03 }}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">
                        {emp.first_name} {emp.last_name}
                        {gaps.length > 0 && (
                          <span className="ml-1 text-[10px] text-warning" title={`Missing: ${gaps.join(", ")}`}>
                            ⚠ missing {gaps.join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{censusAge(emp) ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">
                        {emp.work_state || "—"}
                        {emp.zip_code && <span className="text-muted-foreground"> {emp.zip_code}</span>}
                      </td>
                      <td className="px-3 py-2">{worksiteCell(emp)}</td>
                      <td className="px-3 py-2">{emp.job_title || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{censusPay(emp)}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isAssumed(emp, "classification")
                            ? "bg-muted text-muted-foreground"
                            : emp.classification === "1099"
                              ? "bg-warning/15 text-warning"
                              : "bg-secondary/15 text-secondary"
                        }`}>
                          {classificationLabel(emp)}
                          {emp.employment_type === "part_time" && " PT"}
                        </span>
                        {emp.classification === "1099" && emp.work_state === "CA" && (
                          <span className="ml-1 text-[9px] text-warning">⚠ AB5</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{emp.gender ?? "—"}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{emp.hire_date ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{emp.home_state ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{emp.coverage_tier ?? "—"}</td>
                      <td className="px-3 py-2">{emp.cobra === undefined ? "—" : emp.cobra ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 font-mono">{emp.class_code ?? "—"}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CensusWorkspaceTab;
