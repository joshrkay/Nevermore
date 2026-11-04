import { useEffect, useRef, type ReactNode } from "react";
import type { ChamberData } from "@/data/chamberTypes";
import { eligibilityChecks, employeeFlag, headcount } from "@/data/manuscript";
import { censusPay, classificationLabel, isAssumed } from "@/data/census";
import { fieldOpenItems, formatFieldValue, type FieldAction, type FieldKey, type ProvenanceMap } from "@/data/provenance";
import { missingRecommendedItems, type ReadinessItem, type ReviewSection } from "@/data/readiness";
import { NO_VERIFIED_FIELDS, REQUIRED_ITEM_REASONS, requiredItems, type RequiredItem } from "@/data/requiredItems";
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
];

// Every answer the Manuscript draws on, by section, each editable in place.
function rowsBySection(data: ChamberData): Record<ReviewSection, Row[]> {
  return {
    company: [
      { label: "Company legal name", field: "company_name", display: shown(data.company_name) },
      { label: "Industry", field: "industry", display: shown(data.industry) },
      {
        label: "Entity structure",
        field: "multiple_entities",
        display: data.multiple_entities === null ? null : data.multiple_entities ? `Multiple (${data.fein_count ?? "?"} FEINs)` : "Single entity",
      },
      { label: "Target start", field: "start_month", display: shown(data.start_month) },
      {
        label: "Health coverage today",
        field: "virgin_medical",
        display: data.virgin_medical === null ? null : data.virgin_medical ? "None yet: first employer plan" : "Switching existing coverage",
      },
    ],
    workforce: [
      { label: "Employee count", field: "employee_count", display: shown(data.employee_count) },
      {
        label: "Nonexempt / exempt",
        field: "has_nonexempt",
        display: data.has_nonexempt !== null ? `${data.nonexempt_count ?? 0} nonexempt · ${data.exempt_count ?? 0} exempt` : null,
        editable: false,
      },
      { label: "1099 contractors", field: "has_1099", display: shown(data.has_1099) },
      { label: "In-house HR staff", field: "hr_staff_count", display: shown(data.hr_staff_count) },
      { label: "Employee handbook", field: "has_handbook", display: shown(data.has_handbook) },
    ],
    locations: [
      { label: "HQ state", field: "hq_state", display: shown(data.hq_state) },
      { label: "States of operation", field: "states", display: shown(data.states) },
    ],
    payroll: [
      { label: "Payroll vendor", field: "payroll_vendor", display: shown(data.payroll_vendor) },
      { label: "Pay frequency", field: "pay_frequency", display: shown(data.pay_frequency) },
      { label: "Funding lead time", field: "funding_days", display: data.funding_days !== null ? `${data.funding_days} days` : null },
      { label: "Accrual method", field: "accrual_method", display: shown(data.accrual_method) },
      { label: "PTO types", field: "pto_types", display: shown(data.pto_types) },
    ],
    benefits: [
      { label: "Current carrier", field: "current_carrier", display: shown(data.current_carrier) },
      { label: "Renewal date", field: "renewal_date", display: shown(data.renewal_date) },
      { label: "Waiting period", field: "benefits_waiting_period", display: shown(data.benefits_waiting_period) },
      { label: "Rate history", field: "rate_history", display: shown(data.rate_history) },
      { label: "Ancillary benefits", field: "ancillary_benefits", display: shown(data.ancillary_benefits) },
      {
        label: "Retirement plan",
        field: "has_401k",
        display:
          data.has_401k === null
            ? null
            : data.has_401k
              ? `${data.retirement_type || "401(k)"} · ${data.employer_contributes ? "employer contributes" : "no employer match"}`
              : "No retirement plan",
      },
    ],
  };
}

const rowId = (field: FieldKey) => `review-field-${field}`;
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
      : "Your answers conflict. Choose which is right.";

const Section = ({ section, title, children }: { section: ReviewSection; title: string; children: ReactNode }) => (
  <section id={sectionId(section)} aria-labelledby={`${sectionId(section)}-title`} className="bg-card border border-border rounded-xl p-6 space-y-4">
    <h3 id={`${sectionId(section)}-title`} className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
      {title}
    </h3>
    {children}
  </section>
);

const ReviewTab = ({ data, provenance = {}, onAction, onProceed, documents = [], focusRequest = 0 }: ReviewTabProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusRequest > 0) headingRef.current?.focus();
  }, [focusRequest]);
  const eeCount = headcount(data);
  const required = requiredItems(data, provenance, verified).filter((i) => i.required);
  // Still needed: the required answers that block certification, missing (US-1.2) or in conflict (B-2.2),
  // in their fixed order. A missing one is listed even if an advisor verified its field: verifying never
  // supplies a value.
  const stillNeeded = required.filter((i) => i.state === "missing" || i.state === "conflicting");
  // Then the required answers given but not settled, in order, ahead of every other field that still needs
  // the prospect. A field is listed once, and never one an advisor verified. While the census decides States
  // of operation, the census is the answer to confirm.
  const toSettle = required.flatMap((i) =>
    i.state === "incomplete" || i.state === "unconfirmed"
      ? [i.viaCensus ? { field: "census" as FieldKey, label: "Employee census", reason: REQUIRED_ITEM_REASONS[i.state] } : { field: i.field, label: i.label, reason: REQUIRED_ITEM_REASONS[i.state] }]
      : [],
  );
  const listed = new Set<FieldKey>([...stillNeeded.flatMap((i) => (i.viaCensus ? [i.field, "census" as FieldKey] : [i.field])), ...toSettle.map((i) => i.field)]);
  const needsReview = [...toSettle, ...fieldOpenItems(provenance, verified).filter((i) => !listed.has(i.field))];
  const checks = eligibilityChecks(data);
  const flaggedEmployees = data.census.filter(e => employeeFlag(e) !== null);
  const uploaded = documents.filter((d) => d.status !== "uploading");
  const missing = missingRecommended(uploaded);
  const submitted = submittedCategories(uploaded);
  const required = missingRequired(data);
  const conflicting = conflictingRequired(provenance);
  const blocking = required.length + conflicting.length;
  const recommended = missingRecommendedItems(data);
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

      {/* What's still needed: required answers block certification, recommended ones never do */}
      {blocking > 0 ? (
        <div role="region" aria-label="Still needed" className="bg-card border border-destructive/40 rounded-xl p-6 space-y-3">
          <p className="text-xs font-mono text-destructive uppercase tracking-wider">
            Still needed before The Manuscript can be generated: {blocking}
          </p>
          <ul className="space-y-2">
            {stillNeeded.map((item) => (
              <li key={item.item} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground text-xs">{stillNeededNote(item)}</span>
                <button type="button" onClick={() => jumpTo(item.viaCensus ? CENSUS_SPOT : item.readiness)} className="text-xs font-medium text-primary underline underline-offset-2">
                  Go to {(item.viaCensus ? "Employee census" : item.label).toLowerCase()}
                </button>
              </li>
            ))}
            {/* A required answer given two ways: picking one ("Use this") settles it. */}
            {conflicting.map((item) => (
              <li key={`conflict-${item.key}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground text-xs">You've given two different answers. Choose the right one.</span>
                <button type="button" onClick={() => jumpTo(item)} className="text-xs font-medium text-primary underline underline-offset-2">
                  Choose {item.label.toLowerCase()}
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
        <Section key={key} section={key} title={title}>
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

      {blocking > 0 && (
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
