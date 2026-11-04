import { useEffect, useRef, type ReactNode } from "react";
import type { ChamberData } from "@/data/chamberTypes";
import { coverageTier, eligibilityChecks, employeeFlag, headcount } from "@/data/manuscript";
import { censusPay, classificationLabel, isAssumed } from "@/data/census";
import { FIELD_LABELS, formatFieldValue, type FieldAction, type FieldKey, type ProvenanceMap } from "@/data/provenance";
import { NO_VERIFIED_FIELDS } from "@/data/requiredItems";
import {
  openItems,
  REVIEW_SECTIONS,
  SECTION_STATUS_LABELS,
  sectionFields,
  sectionStatus,
  type OpenItem,
  type ReviewSection,
  type SectionStatus,
} from "@/data/readiness";
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
}

/** A captured value as text, or null when there is nothing to show. 0 and "No" are answers. */
const shown = (value: unknown): string | null =>
  value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0) ? null : formatFieldValue(value);

/** How each answer reads in the Review: the schema's label, and a few values said in words. */
function rowFor(field: Exclude<FieldKey, "census">, data: ChamberData): Row {
  const value = data[field];
  let display = shown(value);
  switch (field) {
    case "multiple_entities":
      display = value === null ? null : value ? "Multiple entities" : "Single entity";
      break;
    case "virgin_medical":
      display = value === null ? null : value ? "None yet: first employer plan" : "Switching existing coverage";
      break;
    case "funding_days":
      display = value === null ? null : `${value} day${value === 1 ? "" : "s"}`;
      break;
    case "wc_experience_mod":
      display = value === null ? null : (value as number).toFixed(2);
      break;
    case "wc_annual_premium":
      display = value === null ? null : `$${(value as number).toLocaleString("en-US")}`;
      break;
  }
  return { label: FIELD_LABELS[field], field, display };
}

const rowId = (field: FieldKey) => `review-field-${field}`;
const sectionId = (section: ReviewSection | "documents") => `review-section-${section}`;

/** Brings an answer, or a section, into view and puts the keyboard on its first button. */
function jumpTo(target: { field?: FieldKey; section: ReviewSection | "documents" }) {
  const element = document.getElementById(target.field ? rowId(target.field) : sectionId(target.section));
  element?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  element?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
}

const STATUS_STYLES: Record<SectionStatus, string> = {
  complete: "bg-success/15 text-success",
  needs_confirmation: "bg-warning/15 text-warning",
  incomplete: "bg-destructive/15 text-destructive",
  not_applicable: "bg-muted text-muted-foreground",
};

const StatusChip = ({ status }: { status: SectionStatus }) => (
  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium normal-case tracking-normal ${STATUS_STYLES[status]}`}>
    {SECTION_STATUS_LABELS[status]}
  </span>
);

const Section = ({ section, title, status, children }: { section: ReviewSection | "documents"; title: string; status: SectionStatus; children: ReactNode }) => (
  <section id={sectionId(section)} aria-labelledby={`${sectionId(section)}-title`} className="bg-card border border-border rounded-xl p-6 space-y-4">
    <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
      <span id={`${sectionId(section)}-title`}>{title}</span>
      <StatusChip status={status} />
    </h3>
    {children}
  </section>
);

const OpenItemLine = ({ item }: { item: OpenItem }) => (
  <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
    <span className="font-medium">{item.label}</span>
    <span className="text-muted-foreground text-xs">{item.action}</span>
    <button type="button" onClick={() => jumpTo(item)} className="text-xs font-medium text-primary underline underline-offset-2">
      Go to {item.label.toLowerCase()}
    </button>
  </li>
);

const ReviewTab = ({ data, provenance = {}, verified = NO_VERIFIED_FIELDS, onAction, onProceed, documents = [], focusRequest = 0 }: ReviewTabProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusRequest > 0) headingRef.current?.focus();
  }, [focusRequest]);
  const eeCount = headcount(data);
  // One list (src/data/readiness.ts): what blocks certification, then everything else still owed.
  const items = openItems(data, provenance, verified);
  const required = items.filter((item) => item.blocking);
  const blocking = required.length;
  const worthALook = items.filter((item) => !item.blocking);
  const checks = eligibilityChecks(data);
  const flaggedEmployees = data.census.filter((e) => employeeFlag(e) !== null);
  const uploaded = documents.filter((d) => d.status !== "uploading");
  const missingDocs = missingRecommended(uploaded);
  const submitted = submittedCategories(uploaded);
  const statuses = Object.fromEntries(REVIEW_SECTIONS.map((s) => [s.key, sectionStatus(s.key, data, provenance, verified, items)])) as Record<ReviewSection, SectionStatus>;
  // Documents are never required; the checklist is complete once every recommended kind is here.
  const documentsStatus: SectionStatus = missingDocs.length === 0 ? "complete" : "incomplete";
  const totalDependents = data.census.reduce((sum, e) => sum + (e.dependents?.length ?? 0), 0);
  const tierCounts = [...data.census.reduce((counts, e) => {
    const tier = coverageTier(e) ?? "Not provided";
    return counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }, new Map<string, number>())];
  const censusStates = [...data.census.reduce((counts, e) => {
    if (e.work_state) counts.set(e.work_state, (counts.get(e.work_state) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())];

  const renderRows = (section: ReviewSection) => (
    <div className="grid sm:grid-cols-2 gap-4">
      {sectionFields(section)
        .filter((field): field is Exclude<FieldKey, "census"> => field !== "census")
        .map((field) => rowFor(field, data))
        .map((row) => (
          <div key={row.field} id={rowId(row.field)}>
            <ProvenanceField
              label={row.label}
              field={row.field}
              display={row.display}
              raw={data[row.field]}
              provenance={provenance[row.field]}
              onAction={onAction}
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
          Everything that goes into The Manuscript, in the same sections. Correct anything here and it's saved right away:
          no need to start the conversation over. Answers marked <span className="text-primary font-medium">Required</span>{" "}
          are needed before you can certify; everything else is recommended, and an answer that doesn't apply to you can
          be marked so.
        </p>
      </div>

      {/* What's still needed: required answers block certification, recommended ones never do */}
      {blocking > 0 ? (
        <div role="region" aria-label="Still needed" className="bg-card border border-destructive/40 rounded-xl p-6 space-y-3">
          <p className="text-xs font-mono text-destructive uppercase tracking-wider">
            Still needed before The Manuscript can be generated: {blocking}
          </p>
          <ul className="space-y-2">
            {required.map((item) => <OpenItemLine key={item.key} item={item} />)}
          </ul>
        </div>
      ) : (
        <div role="status" aria-label="Ready to certify" className="bg-card border border-success/40 rounded-xl p-4 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
          Every required answer is here. You can certify once you've checked the rest.
        </div>
      )}

      {/* One place to see each section's state, and jump to the one that needs work */}
      <nav aria-label="Sections" className="bg-card border border-border rounded-xl p-4">
        <ul className="flex flex-wrap gap-2">
          {REVIEW_SECTIONS.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => jumpTo({ section: s.key })}
                className="flex items-center gap-2 text-xs border border-border rounded-full px-3 py-1 hover:bg-muted"
              >
                {s.title}
                <StatusChip status={statuses[s.key]} />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => jumpTo({ section: "documents" })} className="flex items-center gap-2 text-xs border border-border rounded-full px-3 py-1 hover:bg-muted">
              Documents
              <StatusChip status={documentsStatus} />
            </button>
          </li>
        </ul>
      </nav>

      {/* Inferred, incomplete, conflicting and not-yet-known values, and the recommended census */}
      {worthALook.length > 0 && (
        <div role="region" aria-label="Needs your review" className="bg-card border border-warning/40 rounded-xl p-6 space-y-3">
          <p className="text-xs font-mono text-warning uppercase tracking-wider">
            Needs your review — {worthALook.length} item{worthALook.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-muted-foreground">None of these stops you certifying, but each makes The Manuscript stronger.</p>
          <ul className="space-y-2">
            {worthALook.map((item) => <OpenItemLine key={item.key} item={item} />)}
          </ul>
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

      {REVIEW_SECTIONS.map(({ key, title }) => (
        <Section key={key} section={key} title={title} status={statuses[key]}>
          {renderRows(key)}

          {key === "workforce" && (
            <div id={rowId("census")}>
              {data.census.length === 0 ? (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Employee census
                    <span className="ml-1.5 normal-case tracking-normal font-medium text-muted-foreground">Recommended</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    None yet. Upload one on the Upload tab; you can certify without it.
                  </p>
                </>
              ) : (
                // The census is settled here like any other answer (confirmed, or one roster chosen over another);
                // its rows are changed by uploading a corrected file.
                <ProvenanceField
                  label="Employee census"
                  field="census"
                  display={`${data.census.length} ${data.census.length === 1 ? "person" : "people"}`}
                  raw={data.census}
                  provenance={provenance.census}
                  onAction={onAction}
                  editable={false}
                  required={false}
                >
                  <div className="w-full">
                    <p className="text-xs text-muted-foreground mb-2">
                      {data.census.length} {data.census.length === 1 ? "person" : "people"} ({eeCount} counted toward headcount) ·{" "}
                      {totalDependents} dependent{totalDependents === 1 ? "" : "s"} named · recommended, not required
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground text-left">
                            <th className="pb-2 pr-3">Name</th>
                            <th className="pb-2 pr-3">State</th>
                            <th className="pb-2 pr-3">Title</th>
                            <th className="pb-2 pr-3 text-right">Salary</th>
                            <th className="pb-2 pr-3">Coverage</th>
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
                              <td className="py-1.5 pr-3 text-muted-foreground">{coverageTier(emp) ?? "—"}</td>
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
                      Dependents and coverage: {tierCounts.map(([tier, n]) => `${tier} (${n})`).join(", ")}. To change the census, upload a corrected file on the Upload tab.
                    </p>
                  </div>
                </ProvenanceField>
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
      <Section section="documents" title={`Documents — ${uploaded.length} uploaded`} status={documentsStatus}>
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
          {missingDocs.length > 0 && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Still helpful, if you have them:</dt>
              <dd>{missingDocs.map((c) => c.label.toLowerCase()).join(", ")}</dd>
            </div>
          )}
        </dl>
      </Section>

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
