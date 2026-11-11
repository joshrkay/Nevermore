import type { ReactNode } from "react";
import { categoryInfo } from "@/data/documentCategories";
import { describeSource, EXTRA_QUESTION_LABELS, RULE_PARTS, showRule, type EditableProfile } from "@/data/peoEditor";
import type { ProfilePart } from "@/data/peoProfiles";
import { FIELD_LABELS } from "@/data/provenance";
import { buttonClass, SECTION_TITLES, type SectionKey } from "./shared";

const SourceLine = ({ source }: { source: EditableProfile["sources"][ProfilePart] }) => (
  <p className={`text-xs ${source ? "text-muted-foreground" : "text-warning"}`}>{describeSource(source)}</p>
);

/** One section of a profile: its heading, an Edit button for admins, and either its contents or its editor. */
export const Section = ({ id, section, onEdit, editor, children }: { id: string; section: SectionKey; onEdit?: () => void; editor?: ReactNode; children: ReactNode }) => (
  <section aria-labelledby={`${id}-${section}`} className="border border-border rounded-xl p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={`${id}-${section}`} className="font-display text-base font-bold">{SECTION_TITLES[section]}</h3>
      {onEdit && !editor && (
        <button onClick={onEdit} className={buttonClass} aria-label={`Edit ${SECTION_TITLES[section]}`}>Edit</button>
      )}
    </div>
    {editor ?? children}
  </section>
);

/** Each section's contents, read-only, with where and when each part was checked. */
export const SectionContents = ({ section, profile }: { section: SectionKey; profile: EditableProfile }) => {
  const s = profile.sources;
  switch (section) {
    case "rules":
      return (
        <ul className="space-y-2">
          {RULE_PARTS.map((r) => (
            <li key={r.key} className="text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="block">{showRule(profile, r.key)}</span>
              {profile.rules[r.key] !== null && <SourceLine source={s[r.part]} />}
            </li>
          ))}
        </ul>
      );
    case "answers":
      return (
        <div className="space-y-3 text-sm">
          {([["To quote", profile.neededToQuote], ["Only before signing", profile.neededBeforeSigning]] as const).map(([label, fields]) => (
            <div key={label}>
              <p className="font-medium">{label}</p>
              {fields.length === 0 ? <p className="text-muted-foreground">None listed</p> : (
                <ul className="list-disc pl-5">{fields.map((f) => <li key={f}>{FIELD_LABELS[f] ?? f}</li>)}</ul>
              )}
            </div>
          ))}
          <SourceLine source={s.answers} />
        </div>
      );
    case "census":
      return profile.censusLayout ? (
        <div className="space-y-2 text-sm">
          <p>
            {profile.censusLayout.format === "xlsx" ? "An xlsx file" : "A CSV file"}
            {profile.censusLayout.template
              ? `, filling the PEO template workbook (sheet ${profile.censusLayout.template.sheet}, headers on row ${profile.censusLayout.template.headerRow}, data from row ${profile.censusLayout.template.firstRow})`
              : ""}, with these columns in order:
          </p>
          <ol className="list-decimal pl-5">
            {profile.censusLayout.columns.map((c) => <li key={c.header}>{c.header}{c.from ? "" : " (left blank)"}</li>)}
          </ol>
          <SourceLine source={s.census_layout} />
        </div>
      ) : <p className="text-sm text-muted-foreground">Not checked yet. Its census goes in our own layout.</p>;
    case "documents":
      return (
        <div className="space-y-2 text-sm">
          {profile.documents.length === 0 ? <p className="text-muted-foreground">None listed</p> : (
            <ul className="space-y-1">
              {profile.documents.map((d, i) => <li key={i}><span className="font-medium">{categoryInfo(d.category)?.label ?? d.category}</span>: {d.description}</li>)}
            </ul>
          )}
          <SourceLine source={s.documents} />
        </div>
      );
    case "questions":
      return (
        <div className="space-y-2 text-sm">
          {profile.extraQuestions.length === 0 ? <p className="text-muted-foreground">None listed</p> : (
            <ol className="list-decimal pl-5 space-y-1">
              {profile.extraQuestions.map((q) => (
                <li key={q.key}>{q.text} <span className="text-muted-foreground">({q.kind === "choice" ? (q.choices ?? []).join(" / ") : EXTRA_QUESTION_LABELS[q.kind]})</span></li>
              ))}
            </ol>
          )}
          <SourceLine source={s.extra_questions} />
        </div>
      );
    case "contacts":
      return (
        <div className="space-y-2 text-sm">
          {profile.contacts.length === 0 ? <p className="text-muted-foreground">None listed</p> : (
            <ul className="space-y-1">
              {profile.contacts.map((c, i) => (
                <li key={i}><span className="font-medium">{c.name}</span>{[c.role, c.email, c.phone].filter(Boolean).map((x) => ` · ${x}`).join("")}</li>
              ))}
            </ul>
          )}
          <SourceLine source={s.contacts} />
        </div>
      );
  }
};
