// Synthetic chat transcripts for the extraction eval, each with what the intake must hold after it and, for some
// turns, what Lenore's reply must say.
// Every company, vendor and carrier here is invented. Only fields chamber-extract extracts today
// (FIELD_TYPES in supabase/functions/chamber-extract/schema.ts) are asserted; fixtures.test.ts
// checks that, and that every expected value is one the intake would store as written.

import type { FieldKey, FieldStatus } from "@/data/provenance";
import { FIELDS } from "../../supabase/functions/chamber-extract/schema.ts";

export interface ExpectedField {
  value: unknown;
  /** The field's final provenance status, when the fixture is about it. */
  status?: FieldStatus;
}

/**
 * What Lenore's reply to a turn must say: each pattern, by name, must match her own reply. The function's fallback
 * question, asked when the model gives no reply, doesn't count. Names are lower-case words, as they key a cell.
 */
export type ReplyCheck = Record<string, RegExp>;

export interface Turn {
  message: string;
  reply?: ReplyCheck;
}

export interface Fixture {
  id: string;
  description: string;
  /** The prospect's chat messages, sent one after another. */
  turns: Turn[];
  expected: Partial<Record<FieldKey, ExpectedField>>;
  /** Fields that must stay empty: nothing in the transcript supports them, so the model mustn't guess. */
  absent?: FieldKey[];
  /** Digit sequences (an SSN, an account number) no stored value or quote may contain, whatever separates the digits. */
  forbidden_digits?: string[];
}

/** Lenore names the census template and where to get it (the Upload tab). */
export const CENSUS_TEMPLATE_REPLY: ReplyCheck = { template: /\btemplate\b/i, upload_tab: /\bupload/i };

/** Lenore keeps going: she asks something, and doesn't say the intake is finished (QA F4). */
export const KEEPS_ASKING_REPLY: ReplyCheck = {
  asks: /\?/,
  not_finished: /^(?![\s\S]*\b(?:that(?:'|\u2019)?s everything|that is everything|is complete|have everything|nothing more)\b)/i,
};

export const FIXTURES: Fixture[] = [
  {
    id: "clean-profile",
    description: "A company profile stated outright, every value confirmed; then its entities and HR system.",
    turns: [
      { message: "We're Mossgate Ceramics LLC, headquartered in Oregon. All 23 of our employees work in Oregon." },
      { message: "We run it as two companies, each with its own FEIN, and keep employee records in Thistledown HR." },
    ],
    expected: {
      company_name: { value: "Mossgate Ceramics LLC", status: "confirmed" },
      hq_state: { value: "OR", status: "confirmed" },
      states: { value: ["OR"], status: "confirmed" },
      employee_count: { value: 23, status: "confirmed" },
      multiple_entities: { value: true },
      fein_count: { value: 2 },
      hris_system: { value: "Thistledown HR" },
    },
  },
  {
    id: "inferred-hq",
    description: "A stated value and an inferred one (a practice in Austin is headquartered in Texas), then the staff's mix of hourly and salaried.",
    turns: [
      { message: "I run a dental practice in Austin with 14 people on staff." },
      { message: "Ten of them are hourly; the other four are salaried." },
    ],
    expected: {
      employee_count: { value: 14, status: "confirmed" },
      hq_state: { value: "TX", status: "inferred" },
      has_nonexempt: { value: true },
      nonexempt_count: { value: 10 },
      exempt_count: { value: 4 },
    },
  },
  {
    id: "incomplete-states",
    description: "A partial answer is kept and marked incomplete.",
    turns: [{ message: "We have people in a few states, mainly CA." }],
    expected: {
      states: { value: ["CA"], status: "incomplete" },
    },
  },
  {
    id: "states-extended",
    description: "A later message adds a state; the list grows instead of conflicting.",
    turns: [
      { message: "Our whole team works in Colorado." },
      { message: "Oh, and also Texas: we just opened a small office in Dallas." },
    ],
    expected: {
      states: { value: ["CO", "TX"] },
    },
  },
  {
    id: "explicit-correction",
    description: "An explicit correction replaces the earlier value.",
    turns: [{ message: "We have 40 employees." }, { message: "Actually it's 45, not 40." }],
    expected: {
      employee_count: { value: 45, status: "confirmed" },
    },
  },
  {
    id: "contradiction",
    description: "A different value with no correction language keeps the first and flags a conflict.",
    turns: [{ message: "We have 40 employees." }, { message: "Payroll is getting harder to manage with 55 employees." }],
    expected: {
      employee_count: { value: 40, status: "conflicting" },
    },
  },
  {
    id: "nothing-extractable",
    description: "A question with no facts in it extracts nothing.",
    turns: [{ message: "hi, what is a PEO?" }],
    expected: {},
    // Every field chamber-extract can fill, so a guessed yes-or-no or date fails too.
    absent: FIELDS as FieldKey[],
  },
  {
    id: "ssn-redacted",
    description: "An SSN in a message never reaches the model or any stored field.",
    turns: [{ message: "We're Wrenfield Bakery with 12 employees. For your records, my SSN is 123-45-6789." }],
    expected: {
      company_name: { value: "Wrenfield Bakery" },
      employee_count: { value: 12 },
    },
    forbidden_digits: ["123456789"],
  },
  {
    id: "payroll-benefits",
    description: "Payroll, benefits and workers' comp details across five messages: a retirement plan that isn't a 401(k) still counts as one, a list of benefits, and a decimal experience mod.",
    turns: [
      { message: "We run payroll bi-weekly through Quillfeather Payroll." },
      // The prompt names no date format, so the date is written as the model is likeliest to echo it.
      { message: "Our health plan is with Hollowbrook Mutual, and it renews on 2027-03-01." },
      { message: "For retirement we offer a SIMPLE IRA, and we match up to 3%. We also offer dental and vision." },
      { message: "Payroll has to be funded 2 days before payday." },
      { message: "Workers' comp is with Granite Mutual, renews 2027-07-01, our mod is 0.92 and we pay about $48,000 a year for it." },
    ],
    expected: {
      pay_frequency: { value: "bi-weekly" },
      payroll_vendor: { value: "Quillfeather Payroll" },
      has_401k: { value: true },
      current_carrier: { value: "Hollowbrook Mutual" },
      renewal_date: { value: "2027-03-01" },
      retirement_type: { value: "SIMPLE IRA" },
      employer_contributes: { value: true },
      ancillary_benefits: { value: ["dental", "vision"] },
      funding_days: { value: 2 },
      wc_carrier: { value: "Granite Mutual" },
      wc_renewal_date: { value: "2027-07-01" },
      wc_experience_mod: { value: 0.92 },
      wc_annual_premium: { value: 48000 },
    },
  },
  {
    id: "booleans-negations",
    description: "Yes-or-no answers, including negations: no handbook and no time clocks are false, not blank.",
    turns: [
      { message: "We don't have an employee handbook." },
      { message: "We do use a few 1099 contractors, including two in California." },
      { message: "Our hourly staff clock in on a mobile app. We don't use physical time clocks." },
    ],
    expected: {
      has_handbook: { value: false, status: "confirmed" },
      has_1099: { value: true },
      ca_contractors: { value: true },
      uses_mobile_app: { value: true },
      uses_physical_clocks: { value: false },
    },
  },
  {
    id: "roster-in-chat",
    description: "The prospect starts listing employees in chat: Lenore points to the census template on the Upload tab (US-2.3d), and the people listed don't change the headcount.",
    turns: [
      { message: "We're Brightwater Dental Group: 12 employees, all in Oregon." },
      {
        message: "Here's the team so far: Maria Lopez, office manager, born 4/2/1988, $58,000 a year; Dev Patel, hygienist, born 9/14/1979, $41 an hour.",
        reply: CENSUS_TEMPLATE_REPLY,
      },
    ],
    expected: {
      company_name: { value: "Brightwater Dental Group" },
      // Two people listed is not a headcount of two: a conflict here fails the cell.
      employee_count: { value: 12 },
      states: { value: ["OR"] },
    },
  },
  {
    id: "two-short-answers",
    description: "Two short answers leave most of the intake to ask (QA F4): Lenore asks the next question instead of closing, and nothing the prospect didn't mention is marked unknown.",
    turns: [
      { message: "We're Larkspur Plumbing.", reply: KEEPS_ASKING_REPLY },
      { message: "Bi-weekly. We have 12 employees, all paid hourly, and we use a small local payroll provider.", reply: KEEPS_ASKING_REPLY },
    ],
    expected: {
      company_name: { value: "Larkspur Plumbing" },
      pay_frequency: { value: "bi-weekly" },
      employee_count: { value: 12 },
      has_nonexempt: { value: true },
    },
    absent: ["fein_count", "start_month", "current_carrier", "renewal_date", "funding_days"],
  },
  {
    id: "roster-question",
    description: "Asked how to send the employee list, Lenore points to the census template on the Upload tab (US-2.3d).",
    turns: [{ message: "What's the easiest way to get you our employee list?", reply: CENSUS_TEMPLATE_REPLY }],
    expected: {},
    absent: ["employee_count"],
  },
];
