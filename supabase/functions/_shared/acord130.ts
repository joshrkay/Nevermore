// The yes/no questions of ACORD 130, the Workers Compensation Application, General Information section, edition
// 2017/05 (K-3.4): what every workers' comp application asks, held once so each PEO's supplemental form is
// already answered. `text` is the form's own wording, taken from the form itself and never paraphrased: a PEO's
// underwriter reads the answers against it. `label` and `ask` are ours: what the app calls the question, and how
// Lenore asks it. A new edition of the form is a new list and a new intake schema version.
//
// No imports: the edge functions run it under Deno and the app under Vite.

export const ACORD_130_EDITION = "ACORD 130 (2017/05)";

export interface Acord130Question {
  /** The question's number on the form, 1 to 24. */
  number: number;
  /** The form's wording, exactly. */
  text: string;
  /** What the app calls it. */
  label: string;
  /** How Lenore asks it. */
  ask: string;
  /** How Lenore asks for the explanation a "yes" needs, where the form says what to give. */
  askMore?: string;
}

export const ACORD_130_QUESTIONS: readonly Acord130Question[] = [
  { number: 1, text: "DOES APPLICANT OWN, OPERATE OR LEASE AIRCRAFT / WATERCRAFT?", label: "Aircraft or watercraft", ask: "Does the business own, operate or lease any aircraft or watercraft?" },
  { number: 2, text: "DO / HAVE PAST, PRESENT OR DISCONTINUED OPERATIONS INVOLVE(D) STORING, TREATING, DISCHARGING, APPLYING, DISPOSING, OR TRANSPORTING OF HAZARDOUS MATERIAL? (e.g. landfills, wastes, fuel tanks, etc)", label: "Hazardous material", ask: "Has the business ever stored, treated, discharged, applied, disposed of or transported hazardous material, such as wastes or fuel tanks?" },
  { number: 3, text: "ANY WORK PERFORMED UNDERGROUND OR ABOVE 15 FEET?", label: "Work underground or above 15 feet", ask: "Is any work done underground or more than 15 feet above the ground?" },
  { number: 4, text: "ANY WORK PERFORMED ON BARGES, VESSELS, DOCKS, BRIDGE OVER WATER?", label: "Work on or over water", ask: "Is any work done on barges, vessels, docks or bridges over water?" },
  { number: 5, text: "IS APPLICANT ENGAGED IN ANY OTHER TYPE OF BUSINESS?", label: "Any other type of business", ask: "Is the business engaged in any other type of business besides what you've described?" },
  { number: 6, text: "ARE SUB-CONTRACTORS USED? (If \"YES\", give % of work subcontracted)", label: "Subcontractors used", ask: "Does the business use subcontractors?", askMore: "About what percentage of the work is subcontracted?" },
  { number: 7, text: "ANY WORK SUBLET WITHOUT CERTIFICATES OF INSURANCE? (If \"YES\", payroll for this work must be included in the State Rating Worksheet on Page 2)", label: "Work sublet without certificates of insurance", ask: "Is any work sublet to others who don't give you a certificate of insurance?" },
  { number: 8, text: "IS A WRITTEN SAFETY PROGRAM IN OPERATION?", label: "Written safety program", ask: "Does the business have a written safety program in operation?" },
  { number: 9, text: "ANY GROUP TRANSPORTATION PROVIDED?", label: "Group transportation", ask: "Does the business provide group transportation for employees?" },
  { number: 10, text: "ANY EMPLOYEES UNDER 16 OR OVER 60 YEARS OF AGE?", label: "Employees under 16 or over 60", ask: "Are any employees under 16 or over 60 years of age?" },
  { number: 11, text: "ANY SEASONAL EMPLOYEES?", label: "Seasonal employees", ask: "Does the business have any seasonal employees?" },
  { number: 12, text: "IS THERE ANY VOLUNTEER OR DONATED LABOR? (If \"YES\", please specify)", label: "Volunteer or donated labor", ask: "Does the business use any volunteer or donated labor?", askMore: "What volunteer or donated labor does it use?" },
  { number: 13, text: "ANY EMPLOYEES WITH PHYSICAL HANDICAPS?", label: "Employees with physical handicaps", ask: "Are there any employees with physical handicaps?" },
  { number: 14, text: "DO EMPLOYEES TRAVEL OUT OF STATE? (If \"YES\", indicate state(s) of travel and frequency)", label: "Travel out of state", ask: "Do any employees travel out of state for work?", askMore: "Which states do they travel to, and how often?" },
  { number: 15, text: "ARE ATHLETIC TEAMS SPONSORED?", label: "Athletic teams sponsored", ask: "Does the business sponsor any athletic teams?" },
  { number: 16, text: "ARE PHYSICALS REQUIRED AFTER OFFERS OF EMPLOYMENT ARE MADE?", label: "Physicals after offers of employment", ask: "Does the business require a physical after it makes an offer of employment?" },
  { number: 17, text: "ANY OTHER INSURANCE WITH THIS INSURER?", label: "Other insurance with this insurer", ask: "Does the business have any other insurance with this insurer?" },
  { number: 18, text: "ANY PRIOR COVERAGE DECLINED / CANCELLED / NON-RENEWED IN THE LAST THREE (3) YEARS? (Missouri Applicants - Do not answer this question)", label: "Coverage declined, cancelled or non-renewed in the last three years", ask: "Has any workers' comp coverage been declined, cancelled or non-renewed in the last three years?" },
  { number: 19, text: "ARE EMPLOYEE HEALTH PLANS PROVIDED?", label: "Employee health plans provided", ask: "Does the business provide health plans for its employees?" },
  { number: 20, text: "DO ANY EMPLOYEES PERFORM WORK FOR OTHER BUSINESSES OR SUBSIDIARIES?", label: "Employees work for other businesses or subsidiaries", ask: "Do any employees do work for other businesses or subsidiaries?" },
  { number: 21, text: "DO YOU LEASE EMPLOYEES TO OR FROM OTHER EMPLOYERS?", label: "Employees leased to or from other employers", ask: "Does the business lease employees to or from other employers?" },
  { number: 22, text: "DO ANY EMPLOYEES PREDOMINANTLY WORK AT HOME? If \"YES\", # of Employees:", label: "Employees predominantly working at home", ask: "Do any employees work mostly from home?", askMore: "How many employees work mostly from home?" },
  { number: 23, text: "ANY TAX LIENS OR BANKRUPTCY WITHIN THE LAST FIVE (5) YEARS? (If \"YES\", please specify)", label: "Tax liens or bankruptcy in the last five years", ask: "Has the business had any tax liens or a bankruptcy in the last five years?", askMore: "What were the tax liens or the bankruptcy?" },
  { number: 24, text: "ANY UNDISPUTED AND UNPAID WORKERS COMPENSATION PREMIUM DUE FROM YOU OR ANY COMMONLY MANAGED OR OWNED ENTERPRISES? IF YES, EXPLAIN INCLUDING ENTITY NAME(S) AND POLICY NUMBER(S).", label: "Unpaid workers' comp premium due", ask: "Is any undisputed workers' comp premium unpaid, by the business or any business under the same management or ownership?", askMore: "Which entities and policy numbers is the unpaid premium for?" },
];

/** The intake field that holds a question's yes or no: `wcq_01` to `wcq_24`. */
export const acordAnswerKey = (number: number): string => `wcq_${String(number).padStart(2, "0")}`;
/** The intake field that holds the explanation a "yes" needs: `wcq_01_explain` to `wcq_24_explain`. */
export const acordExplainKey = (number: number): string => `${acordAnswerKey(number)}_explain`;

/** The question a field belongs to and which half of it the field is, or undefined for any other field. */
export function acordField(field: string): { question: Acord130Question; part: "answer" | "explain" } | undefined {
  const m = /^wcq_(\d{2})(_explain)?$/.exec(field);
  const question = m ? ACORD_130_QUESTIONS.find((q) => q.number === Number(m[1])) : undefined;
  return question ? { question, part: m![2] ? "explain" : "answer" } : undefined;
}
