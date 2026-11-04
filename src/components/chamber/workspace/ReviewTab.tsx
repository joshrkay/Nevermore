import { useEffect, useRef, type ReactNode } from "react";
import type { ChamberData } from "@/data/chamberTypes";
import { eligibilityChecks, employeeFlag, headcount } from "@/data/manuscript";
import { censusPay, classificationLabel, isAssumed } from "@/data/census";
import { FIELD_LABELS, formatFieldValue, type FieldAction, type FieldKey, type ProvenanceMap } from "@/data/provenance";
import { isSettled } from "@/data/followUp";
import { openItems } from "@/data/openItems";
import { REVIEW_FIELDS } from "@/data/reviewFields";
import { missingRecommendedItems, type ReadinessItem, type ReviewSection } from "@/data/readiness";
import { certificationBlockingItems, NO_VERIFIED_FIELDS, requiredItems, type RequiredItem } from "@/data/requiredItems";
import { categoryInfo, missingRecommended, submittedCategories } from "@/data/documentCategories";
import { documentStatusInfo } from "@/data/documentStatus";
import { CheckCircle, AlertTriangle, HelpCircle, FileText } from "lucide-react";
import ProvenanceField from "./ProvenanceField";

interface ReviewDocument {
  id: string;
  file_name: string;
  category: string;
  status: string;
}

interface ReviewTabProps {
  data: ChamberData;
  provenance?: ProvenanceMap;
  /** Fields an advisor verified: settled whatever their status, so never listed. */
  verified?: ReadonlySet<string>;
  onAction?: (action: FieldAction) => void;
  onProceed: () => void;
  documents?: ReviewDocument[];
  /** Raise it to put the keyboard on the heading, as when the prospect chose to fill the intake in themselves. */
  focusRequest?: number;
}

interface Row {
  label: string;
  field: FieldKey;
  /** Formatted value, or null when nothing has been captured. */
  display: string | null;
  /** False for composite rows whose display isn't one editable value. */
  editable?: boolean;
}

/** A captured value as text, or null when there is nothing to show. 0 and "No" are answers. */
const shown = (value: unknown): string | null =>
  value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0) ? null : formatFieldValue(value);

const SECTIONS: { key: ReviewSection; title: string }[] = [
  { key: "company", title: "Company" },
  { key: "workforce", title: "Workforce" },
  { key: "locations", title: "Locations" },
  { key: "payroll", title: "Payroll" },
  { key: "benefits", title: "Benefits" },
  { key: "workers_comp", title: "Workers' comp" },
  { key: "operations", title: "Operations & HR" },
];

const displayOf = (field: FieldKey, value: unknown): string | null => {
  const text = shown(value);
  if (text === null) return null;
  if (field === "funding_days") return `${text} days`;
  if (field === "wc_annual_premium" && typeof value === "number") return `$${value.toLocaleString()}`;
  return text;
};

// Every answer the Manuscript draws on, by section, each editable in place.
function rowsBySection(data: ChamberData): Record<ReviewSection, Row[]> {
  return Object.fromEntries(
    SECTIONS.map(({ key }) => [key, REVIEW_FIELDS[key].map((field) => ({ label: FIELD_LABELS[field], field, display: displayOf(field, data[field]) }))]),
  ) as Record<ReviewSection, Row[]>;
}

/** How many of a section's answers are settled (an answer, or "Doesn't apply" or "Not known yet"), of how many. */
function sectionProgress(section: ReviewSection, data: ChamberData, provenance: ProvenanceMap): { settled: number; total: number } {
  const fields = REVIEW_FIELDS[section];
  const settled = fields.filter((f) => isSettled(data[f], provenance[f]?.status)).length;
  // The census counts in Workforce, settled once one is uploaded.
  return section === "workforce"
    ? { settled: settled + (data.census.length > 0 ? 1 : 0), total: fields.length + 1 }
    : { settled, total: fields.length };
}

const rowId = (field: FieldKey) => `review-field-${field}`;
// What the open-items list says of a field that is open for its status, as against a required answer still to give.
const STATUS_REASONS: ReadonlySet<string> = new Set(["Conflicting answers", "Incomplete", "Prospect to provide", "Please confirm"]);

const sectionId = (section: ReviewSection) => `review-section-${section}`;

/** Brings an answer into view and puts the keyboard on its Add or Edit button. */
function jumpTo(item: Pick<ReadinessItem, "field" | "section">) {
  const target = document.getElementById(item.field ? rowId(item.field) : sectionId(item.section));
  target?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  target?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
}

/** Where the census is answered, for States of operation that the census decides. */
const CENSUS_SPOT = { section: "workforce" as ReviewSection };

/** Why a required answer is still needed: what to give, or that its answers disagree. */
const stillNeededNote = (item: RequiredItem): string =>
  item.state === "missing"
    ? item.readiness.hint
    : item.viaCensus
      ? "The census's answers conflict, and it gives your states. Choose which is right."
      : "You've given two different answers. Choose the right one.";

const Section = ({ section, title, progress, children }: { section: ReviewSection; title: string; progress: { settled: number; total: number }; children: ReactNode }) => (
  <section id={sectionId(section)} aria-labelledby={`${sectionId(section)}-title`} className="bg-card border border-border rounded-xl p-6 space-y-4">
    <div className="flex items-baseline justify-between gap-2">
      <h3 id={`${sectionId(section)}-title`} className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <p className="text-[10px] text-muted-foreground" data-testid={`progress-${section}`}>
        {progress.settled === progress.total ? "Complete" : `${progress.settled} of ${progress.total} settled`}
      </p>
    </div>
    {children}
  </section>
);

const ReviewTab = ({ data, provenance = {}, verified = NO_VERIFIED_FIELDS, onAction, onProceed, documents = [], focusRequest = 0 }: ReviewTabProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusRequest > 0) headingRef.current?.focus();
  }, [focusRequest]);
  const eeCount = headcount(data);
  // Still needed: the required answers that block certification, missing (US-1.2) or in conflict (B-2 D26),
  // in their fixed order, as certificationBlockingItems decides for the Reckoning too. A missing one is
  // listed even if an advisor verified its field (verifying never supplies a value), and so is one in
  // conflict (the database refuses it whoever verified it).
  const stillNeeded = certificationBlockingItems(data, provenance, verified);
  // One list of open items (src/data/openItems.ts), shared with The Manuscript and the advisor queue. The census
  // is "Recommended", and fields by status are "Needs your review", never one an advisor verified. A field is
  // listed once: not under "Needs your review" when "Still needed" lists it already. While the census decides
  // States of operation, the census is the answer to confirm.
  const open = openItems(data, provenance, verified);
  const stillListed = new Set<string>(stillNeeded.flatMap((i) => (i.viaCensus ? [i.field, "census"] : [i.field])));
  // The required answers given but not settled come first, in their fixed order, ahead of every other field that
  // still needs the prospect (the sort is stable, so the rest keep the list's order).
  const requiredOrder: string[] = requiredItems(data, provenance, verified).flatMap((i) => (i.required ? [i.viaCensus ? "census" : i.field] : []));
  const priority = (field: string) => (requiredOrder.includes(field) ? requiredOrder.indexOf(field) : requiredOrder.length);
  const needsReview = open
    .flatMap((item) => (item.field && STATUS_REASONS.has(item.reason) && !stillListed.has(item.field) ? [{ ...item, field: item.field }] : []))
    .sort((a, b) => priority(a.field) - priority(b.field));
  const checks = eligibilityChecks(data);
  const flaggedEmployees = data.census.filter(e => employeeFlag(e) !== null);
  const uploaded = documents.filter((d) => d.status !== "uploading");
  const missing = missingRecommended(uploaded);
  const submitted = submittedCategories(uploaded);
  const recommended = missingRecommendedItems(data).filter((item) => open.some((o) => o.key === item.key));
  const rows = rowsBySection(data);
  const totalDependents = data.census.reduce((sum, e) => sum + (e.dependents?.length ?? 0), 0);
  const censusStates = [...data.census.reduce((counts, e) => {
    if (e.work_state) counts.set(e.work_state, (counts.get(e.work_state) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())];

  const renderRows = (list: Row[]) => (
    <div className="grid sm:grid-cols-2 gap-4">
      {list.map((row) => (
        <div key={row.field} id={rowId(row.field)}>
          <ProvenanceField
            label={row.label}
            field={row.field}
            display={row.display}
            raw={data[row.field]}
            provenance={provenance[row.field]}
            onAction={onAction}
            editable={row.editable}
            allowNotApplicable
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold mb-2 focus:outline-none">Review</h2>
        <p className="text-muted-foreground text-sm">
          Everything that goes into The Manuscript, by section. Correct anything here and it's saved right away: no need
          to start the conversation over. <span className="text-primary font-medium">Required</span> answers are needed
          before you can certify.
        </p>
      </div>

      {/* What's still needed: required answers missing or in conflict block certification; recommended ones never do */}
      {stillNeeded.length > 0 ? (
        <div role="region" aria-label="Still needed" className="bg-card border border-destructive/40 rounded-xl p-6 space-y-3">
          <p className="text-xs font-mono text-destructive uppercase tracking-wider">
            Still needed before The Manuscript can be generated: {stillNeeded.length}
          </p>
          <ul className="space-y-2">
            {stillNeeded.map((item) => (
              <li key={item.item} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground text-xs">{stillNeededNote(item)}</span>
                {/* A required answer given two ways is settled where it sits, by picking one ("Use this"). */}
                <button type="button" onClick={() => jumpTo(item.viaCensus ? CENSUS_SPOT : item.readiness)} className="text-xs font-medium text-primary underline underline-offset-2">
                  {item.state === "conflicting" && !item.viaCensus ? "Choose" : "Go to"} {(item.viaCensus ? "Employee census" : item.label).toLowerCase()}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div role="status" className="bg-card border border-success/40 rounded-xl p-4 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
          Every required answer is here. You can certify once you've checked the rest.
        </div>
      )}
      {recommended.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 text-sm space-y-1">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Recommended</p>
          {recommended.map((item) => (
            <p key={item.key}>
              <span className="font-medium">{item.label}</span>{" "}
              <span className="text-muted-foreground text-xs">{item.hint}</span>
            </p>
          ))}
        </div>
      )}

      {/* Inferred, incomplete, and conflicting values */}
      {needsReview.length > 0 && (
        <div className="bg-card border border-warning/40 rounded-xl p-6 space-y-4">
          <p className="text-xs font-mono text-warning uppercase tracking-wider">
            Needs your review — {needsReview.length} item{needsReview.length === 1 ? "" : "s"}
          </p>
          {needsReview.map((item) => (
            <div key={item.field}>
              <p className="text-[10px] text-muted-foreground mb-0.5">{item.reason}</p>
              <ProvenanceField
                label={item.label}
                field={item.field}
                display={shown(data[item.field])}
                raw={data[item.field]}
                provenance={provenance[item.field]}
                onAction={onAction}
              />
            </div>
          ))}
        </div>
      )}

      {/* Eligibility check */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Eligibility Check</p>
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {c.status === "pass" && <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />}
            {c.status === "fail" && <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />}
            {c.status === "unknown" && <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
            <span className={`text-sm ${c.status === "unknown" ? "text-muted-foreground" : "text-foreground"}`}>
              {c.label}{c.status === "unknown" && " — not yet verified"}
            </span>
          </div>
        ))}
        {flaggedEmployees.length > 0 && (
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">
              {flaggedEmployees.length} job classification{flaggedEmployees.length > 1 ? "s" : ""} need{flaggedEmployees.length === 1 ? "s" : ""} confirmation (flagged below)
            </span>
          </div>
        )}
      </div>

      {SECTIONS.map(({ key, title }) => (
        <Section key={key} section={key} title={title} progress={sectionProgress(key, data, provenance)}>
          {renderRows(rows[key])}

          {key === "workforce" && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Employee census
                <span className="ml-1.5 normal-case tracking-normal font-medium text-muted-foreground">Recommended</span>
              </p>
              {data.census.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  None yet. Upload one on the Upload tab; you can certify without it.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    {data.census.length} {data.census.length === 1 ? "person" : "people"} ({eeCount} counted toward headcount) ·{" "}
                    {totalDependents} dependent{totalDependents === 1 ? "" : "s"}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground text-left">
                          <th className="pb-2 pr-3">Name</th>
                          <th className="pb-2 pr-3">State</th>
                          <th className="pb-2 pr-3">Title</th>
                          <th className="pb-2 pr-3 text-right">Salary</th>
                          <th className="pb-2 text-center">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.census.map((emp) => (
                          <tr key={emp.id} className="border-b border-border last:border-0">
                            <td className="py-1.5 pr-3 font-medium">{emp.first_name} {emp.last_name}</td>
                            <td className="py-1.5 pr-3 font-mono">{emp.work_state || "—"}</td>
                            <td className="py-1.5 pr-3">{emp.job_title || "—"}</td>
                            <td className="py-1.5 pr-3 text-right font-mono">{censusPay(emp)}</td>
                            <td className="py-1.5 text-center">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                isAssumed(emp, "classification")
                                  ? "bg-muted text-muted-foreground"
                                  : emp.classification === "1099" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
                              }`}>{classificationLabel(emp)}</span>
                              {employeeFlag(emp) && (
                                <span title={employeeFlag(emp) ?? undefined} className="ml-1 text-[10px] text-warning">⚠</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    To change the census, upload a corrected file on the Upload tab.
                  </p>
                </>
              )}
            </div>
          )}

          {key === "locations" && censusStates.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Where the census says people work</p>
              <p className="text-sm">{censusStates.map(([state, count]) => `${state} (${count})`).join(", ")}</p>
            </div>
          )}
        </Section>
      ))}

      {/* Documents — informational only; missing ones never block moving on */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
          Documents — {uploaded.length} uploaded
        </p>
        {uploaded.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded. That's fine — you can still continue.</p>
        ) : (
          <ul className="space-y-2">
            {uploaded.map((d) => {
              const status = documentStatusInfo(d.status);
              return (
                <li key={d.id} className="flex items-center gap-2.5 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{d.file_name}</span>
                  <span className="text-xs text-muted-foreground">{categoryInfo(d.category).label}</span>
                  <span className={`text-xs ${status.tone === "warn" ? "text-warning" : "text-muted-foreground"}`}>
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Submitted:</dt>
            <dd>{submitted.length > 0 ? submitted.map((c) => c.label).join(", ") : "none yet"}</dd>
          </div>
          {missing.length > 0 && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Still helpful, if you have them:</dt>
              <dd>{missing.map((c) => c.label.toLowerCase()).join(", ")}</dd>
            </div>
          )}
        </dl>
      </div>

      {stillNeeded.length > 0 && (
        <p className="text-xs text-muted-foreground">
          You can choose a PEO now. The answers marked Required are needed, each with one answer, before The Manuscript can be generated.
        </p>
      )}
      <button
        onClick={onProceed}
        className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:bg-primary/90 transition-colors"
      >
        See Your PEO Matches →
      </button>
    </div>
  );
};

export default ReviewTab;
