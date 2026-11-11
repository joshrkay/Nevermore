import { describe, expect, it } from "vitest";
import { describeSource, EMPTY_PROFILE, industriesText, parseProfileVersion, profileChanges, profilePayload, profileProblems, publishProblems, readIndustries, showRule, type EditableProfile } from "./peoEditor";
import type { ProfileSource } from "./peoProfiles";

const TODAY = "2026-11-11";
const guide: ProfileSource = { kind: "document", name: "Broker guide 2026", link: "https://trinet.example/guide.pdf", checkedOn: "2026-10-20" };
const dana: ProfileSource = { kind: "person", name: "Dana Reyes", role: "Broker desk manager", checkedOn: "2026-11-02" };

// The same full profile the SQL test saves (supabase/tests/peo_profiles.sql), as the editor holds it.
const FULL: EditableProfile = {
  neededToQuote: ["company_name", "states", "census"],
  neededBeforeSigning: ["payroll_vendor"],
  censusLayout: { peo: "TriNet", format: "xlsx", templateFile: null, columns: [
    { header: "Last Name", from: "last_name" }, { header: "First Name", from: "first_name" }, { header: "SSN", from: null },
  ] },
  documents: [{ category: "workers_comp_loss_runs", description: "Three years of loss runs" }],
  rules: { minHeadcount: 5, statesServed: ["CA", "NY"], excludedIndustries: ["Trucking"], excludedClassCodes: ["7219"], minEnrolmentPercent: 75 },
  extraQuestions: [
    { key: "uses_drivers", text: "Do any employees drive for work?", kind: "yes_no" },
    { key: "union", text: "Which union?", kind: "choice", choices: ["None", "Teamsters"] },
  ],
  contacts: [{ name: "Dana Reyes", role: "Broker desk", email: "dana@trinet.example", phone: "555-0100" }],
  sources: {
    answers: dana, census_layout: guide, documents: guide, extra_questions: dana, contacts: dana,
    min_headcount: dana, states_served: guide, excluded_industries: { ...guide, checkedOn: "2026-09-01" }, excluded_class_codes: guide, min_enrolment_percent: dana,
  },
};

const problems = (over: Partial<EditableProfile>) => profileProblems({ ...EMPTY_PROFILE, ...over }, TODAY);

describe("profileProblems: the database's rules, next to each field", () => {
  it("finds nothing wrong with a full, sourced profile, or an empty one", () => {
    expect(profileProblems(FULL, TODAY)).toEqual([]);
    expect(profileProblems(EMPTY_PROFILE, TODAY)).toEqual([]);
    expect(publishProblems(FULL)).toEqual([]);
  });

  it("refuses the answers the database refuses", () => {
    expect(problems({ neededToQuote: ["employees" as never] })).toEqual([{ path: "neededToQuote.0", message: "employees isn't an answer the intake asks for" }]);
    expect(problems({ neededToQuote: ["states"], neededBeforeSigning: ["states"] })).toEqual([
      { path: "neededBeforeSigning.0", message: "Each answer is listed once: needed to quote, or needed only before signing" },
    ]);
  });

  it("refuses a census layout the database refuses, at the column it is about", () => {
    const layout = (over: object) => ({ censusLayout: { peo: "TriNet", format: "csv", templateFile: null, columns: [{ header: "Name", from: "first_name" }], ...over } as EditableProfile["censusLayout"] });
    expect(problems(layout({ columns: [] }))).toEqual([{ path: "censusLayout.columns", message: "A census layout has 1 to 200 columns" }]);
    expect(problems(layout({ columns: [{ header: " ", from: null }] }))).toEqual([
      { path: "censusLayout.columns.0.header", message: "Each census column has a header of 1 to 100 characters" },
    ]);
    expect(problems(layout({ columns: [{ header: "Name", from: "first_name" }, { header: "name ", from: "last_name" }] }))).toEqual([
      { path: "censusLayout.columns.1.header", message: "Each census column has a header of its own" },
    ]);
    expect(problems(layout({ columns: [{ header: "SSN", from: "ssn" }] }))).toEqual([{ path: "censusLayout.columns.0.from", message: "ssn isn't one of our census columns" }]);
    expect(problems(layout({ templateFile: " " }))).toEqual([
      { path: "censusLayout.templateFile", message: "A template file is named by its path, up to 300 characters, or not at all" },
    ]);
    expect(problems(layout({ columns: Array.from({ length: 201 }, (_, i) => ({ header: `C${i}`, from: null })) }))[0].path).toBe("censusLayout.columns");
    expect(problems(layout({ columns: Array.from({ length: 200 }, (_, i) => ({ header: `C${i}`, from: null })) }))).toEqual([]);
  });

  it("refuses documents the database refuses", () => {
    expect(problems({ documents: [{ category: "tax_return" as never, description: "Return" }] })).toEqual([
      { path: "documents.0.category", message: "Each document is one of the kinds of document the intake takes" },
    ]);
    expect(problems({ documents: [{ category: "payroll_report", description: "" }] })).toEqual([
      { path: "documents.0.description", message: "Each document says what the PEO wants, in 1 to 500 characters" },
    ]);
  });

  it("refuses eligibility rules the database refuses", () => {
    const rules = (over: object) => ({ rules: { ...EMPTY_PROFILE.rules, ...over } });
    expect(problems(rules({ minHeadcount: 0 }))).toEqual([{ path: "rules.minHeadcount", message: "A minimum headcount is a whole number of employees from 1 to 100,000" }]);
    expect(problems(rules({ minHeadcount: 2.5 }))[0].path).toBe("rules.minHeadcount");
    expect(problems(rules({ statesServed: [] }))).toEqual([{ path: "rules.statesServed", message: "The states served are US state or territory codes such as CA, each once, and at least one" }]);
    expect(problems(rules({ statesServed: ["XX"] }))[0].path).toBe("rules.statesServed");
    expect(problems(rules({ statesServed: ["CA", "CA"] }))[0].path).toBe("rules.statesServed");
    expect(problems(rules({ excludedIndustries: [" "] }))).toEqual([{ path: "rules.excludedIndustries", message: "Up to 100 excluded industries, each named in 1 to 100 characters" }]);
    expect(problems(rules({ excludedIndustries: ["Trucking "] }))[0].path).toBe("rules.excludedIndustries");
    expect(problems(rules({ excludedClassCodes: ["88"] }))).toEqual([{ path: "rules.excludedClassCodes", message: "Up to 100 excluded class codes, each four digits" }]);
    expect(problems(rules({ minEnrolmentPercent: 0 }))).toEqual([{ path: "rules.minEnrolmentPercent", message: "A minimum enrolment is a percentage above 0 and up to 100" }]);
    expect(problems(rules({ minEnrolmentPercent: 101 }))[0].path).toBe("rules.minEnrolmentPercent");
    expect(problems(rules({ minEnrolmentPercent: 100, minHeadcount: 100000 }))).toEqual([]);
  });

  it("refuses extra questions the database refuses", () => {
    const q = (over: object) => ({ extraQuestions: [{ key: "a", text: "A?", kind: "text" as const, ...over }] });
    expect(problems(q({ key: "Has Drivers?" }))).toEqual([
      { path: "extraQuestions.0.key", message: "Each extra question has a key of lower-case letters, digits and underscores, starting with a letter, up to 40 characters" },
    ]);
    expect(problems(q({ text: "" }))).toEqual([{ path: "extraQuestions.0.text", message: "Each extra question is 1 to 500 characters" }]);
    expect(problems(q({ kind: "choice", choices: ["Yes"] }))).toEqual([
      { path: "extraQuestions.0.choices", message: "A choice question has 2 to 20 different choices, each 1 to 100 characters" },
    ]);
    expect(problems(q({ kind: "choice", choices: ["Yes", "yes"] }))[0].path).toBe("extraQuestions.0.choices");
    expect(problems({ extraQuestions: [{ key: "a", text: "A?", kind: "text" }, { key: "a", text: "B?", kind: "number" }] })).toEqual([
      { path: "extraQuestions.1.key", message: "Each extra question has a key of its own" },
    ]);
    expect(problems({ extraQuestions: Array.from({ length: 31 }, (_, i) => ({ key: `q${i}`, text: "Q?", kind: "text" as const })) })).toEqual([
      { path: "extraQuestions", message: "A profile has up to 30 extra questions" },
    ]);
  });

  it("refuses contacts the database refuses", () => {
    const c = (over: object) => ({ contacts: [{ name: "Dana", role: null, email: null, phone: null, ...over }] });
    expect(problems(c({ name: " " }))).toEqual([{ path: "contacts.0.name", message: "Each contact has a name of 1 to 200 characters" }]);
    expect(problems(c({ email: "dana" }))).toEqual([{ path: "contacts.0.email", message: "A contact's email must be an email address" }]);
    expect(problems(c({ phone: "5".repeat(41) }))).toEqual([{ path: "contacts.0.phone", message: "A contact's phone number is up to 40 characters" }]);
    expect(problems(c({ role: "r".repeat(101) }))).toEqual([{ path: "contacts.0.role", message: "A contact's role is up to 100 characters" }]);
    expect(problems({ contacts: Array.from({ length: 21 }, () => ({ name: "Dana", role: null, email: null, phone: null })) })).toEqual([
      { path: "contacts", message: "A profile names up to 20 contacts" },
    ]);
  });

  it("refuses a source the database refuses, at the part it is for", () => {
    const sourced = (source: ProfileSource) => problems({ rules: { ...EMPTY_PROFILE.rules, minHeadcount: 5 }, sources: { min_headcount: source } });
    expect(sourced({ ...guide, name: " " })).toEqual([
      { path: "sources.min_headcount.name", message: "A source is named, by its title or the person's name, in 1 to 300 characters" },
    ]);
    expect(sourced({ kind: "person", name: "Dana", role: "", checkedOn: "2026-11-01" })).toEqual([
      { path: "sources.min_headcount.role", message: "A person at the PEO is named with their role, of 1 to 100 characters" },
    ]);
    expect(sourced({ ...guide, link: "javascript:alert(1)" })).toEqual([
      { path: "sources.min_headcount.link", message: "A link is a web address starting http:// or https://" },
    ]);
    expect(sourced({ ...guide, checkedOn: "" })).toEqual([{ path: "sources.min_headcount.checkedOn", message: "Each source has the date it was checked" }]);
    expect(sourced({ ...guide, checkedOn: "2026-02-30" })).toEqual([{ path: "sources.min_headcount.checkedOn", message: "2026-02-30 isn't a date" }]);
    // One day of grace for an admin ahead of the database's clock; never two.
    expect(sourced({ ...guide, checkedOn: "2026-11-12" })).toEqual([]);
    expect(sourced({ ...guide, checkedOn: "2026-11-13" })).toEqual([
      { path: "sources.min_headcount.checkedOn", message: "A source can't be checked on a date that hasn't come" },
    ]);
    // A rule or a census layout that isn't set isn't sourced, so it has no source.
    expect(problems({ sources: { min_headcount: guide } })).toEqual([{ path: "sources.min_headcount", message: "Minimum headcount isn't set, so it has no source" }]);
    expect(problems({ sources: { census_layout: guide } })[0].path).toBe("sources.census_layout");
  });
});

describe("publishProblems: what a version must say before it is published", () => {
  it("asks where every part that holds something came from", () => {
    expect(publishProblems({ ...EMPTY_PROFILE, rules: { ...EMPTY_PROFILE.rules, minHeadcount: 5 }, documents: FULL.documents, sources: { min_headcount: dana } })).toEqual([
      { path: "sources.documents", message: "Name where the documents came from, and when it was checked, before publishing" },
    ]);
    expect(publishProblems({ ...EMPTY_PROFILE, contacts: FULL.contacts, sources: { min_headcount: dana }, rules: { ...EMPTY_PROFILE.rules, minHeadcount: 5 } })).toEqual([
      { path: "sources.contacts", message: "Name where the contacts came from, and when it was checked, before publishing" },
    ]);
  });

  it("has nothing to publish with nothing sourced, while a sourced empty section says the PEO asks for none", () => {
    expect(publishProblems(EMPTY_PROFILE)).toEqual([{ path: "sources", message: "A profile with nothing sourced has nothing to publish" }]);
    expect(publishProblems({ ...EMPTY_PROFILE, sources: { documents: guide } })).toEqual([]);
  });
});

describe("describeSource", () => {
  it("names a document by its title and a person at the PEO by name and role, each with the date checked", () => {
    expect(describeSource(guide)).toBe("Document: Broker guide 2026 · checked 20 Oct 2026");
    expect(describeSource(dana)).toBe("Broker desk: Dana Reyes, Broker desk manager · checked 2 Nov 2026");
    expect(describeSource(undefined)).toBe("Not checked yet");
  });
});

describe("a profile version, to and from the database", () => {
  it("sends the editor's profile as admin_save_peo_profile takes it, and reads the stored row back the same", () => {
    const payload = profilePayload(FULL);
    expect(payload).toMatchObject({
      needed_to_quote: ["company_name", "states", "census"],
      census_layout: { format: "xlsx", template_file: null, columns: [{ header: "Last Name", from: "last_name" }, { header: "First Name", from: "first_name" }, { header: "SSN", from: null }] },
      min_headcount: 5,
      min_enrolment_percent: 75,
      sources: { min_headcount: { kind: "person", name: "Dana Reyes", role: "Broker desk manager", checked_on: "2026-11-02" }, census_layout: { kind: "document", name: "Broker guide 2026", link: "https://trinet.example/guide.pdf", checked_on: "2026-10-20" } },
      contacts: [{ name: "Dana Reyes", role: "Broker desk", email: "dana@trinet.example", phone: "555-0100" }],
    });
    const row = { id: 9, version: 2, status: "draft", created_at: "2026-11-01T00:00:00Z", published_at: null, ...payload, min_enrolment_percent: "75.00" };
    const contacts = [{ profile_version_id: 9, position: 1, name: "Dana Reyes", role: "Broker desk", email: "dana@trinet.example", phone: "555-0100" }];
    const version = parseProfileVersion("TriNet", row, contacts);
    expect(version).toMatchObject({ id: 9, version: 2, status: "draft", publishedAt: null });
    expect(version.profile).toEqual(FULL);
  });
});

describe("profileChanges: what publishing a draft changes", () => {
  it("says nothing changed when nothing did", () => {
    expect(profileChanges(FULL, FULL)).toEqual([]);
  });

  it("names each rule's old and new value, and each source that changed", () => {
    const next: EditableProfile = { ...FULL, rules: { ...FULL.rules, minHeadcount: 10, excludedClassCodes: null }, sources: { ...FULL.sources, min_headcount: { ...dana, checkedOn: "2026-11-09" } } };
    delete next.sources.excluded_class_codes;
    expect(profileChanges(FULL, next)).toEqual([
      "Minimum headcount: 5 → 10",
      "Excluded class codes: 7219 → Not checked yet",
      "Where the minimum headcount was checked: Broker desk: Dana Reyes, Broker desk manager · checked 2 Nov 2026 → Broker desk: Dana Reyes, Broker desk manager · checked 9 Nov 2026",
      "Where the excluded class codes were checked: Document: Broker guide 2026 · checked 20 Oct 2026 → Not checked yet",
    ]);
  });

  it("lists answers, documents, questions and contacts added and removed, and a census layout that changed", () => {
    const next: EditableProfile = {
      ...FULL,
      neededToQuote: ["company_name", "census", "pay_frequency"],
      documents: [],
      extraQuestions: [FULL.extraQuestions[0]],
      contacts: [{ name: "Sam Lee", role: null, email: null, phone: null }],
      censusLayout: { ...FULL.censusLayout!, columns: [FULL.censusLayout!.columns[1], FULL.censusLayout!.columns[0], FULL.censusLayout!.columns[2]] },
    };
    expect(profileChanges(FULL, next)).toEqual([
      "Answers needed to quote: added Pay frequency; removed States of operation",
      "Census layout: columns now First Name, Last Name, SSN",
      "Documents: removed Workers' comp loss runs (Three years of loss runs)",
      "Its own questions: removed Which union?",
      "Contacts: added Sam Lee; removed Dana Reyes",
    ]);
  });

  it("names a contact's changed details, a question answered another way, and the census file and template", () => {
    const next: EditableProfile = {
      ...FULL,
      contacts: [{ ...FULL.contacts[0], phone: "555-0199" }],
      extraQuestions: [{ ...FULL.extraQuestions[0], kind: "text" }, FULL.extraQuestions[1]],
      censusLayout: { ...FULL.censusLayout!, format: "csv", templateFile: "peo-templates/trinet.xlsx" },
    };
    expect(profileChanges(FULL, next)).toEqual([
      "Census file: xlsx → CSV",
      "Template file: None → peo-templates/trinet.xlsx",
      "Its own questions: Do any employees drive for work? (yes or no) → Do any employees drive for work? (text)",
      "Contacts: Dana Reyes, Broker desk, dana@trinet.example, 555-0100 → Dana Reyes, Broker desk, dana@trinet.example, 555-0199",
    ]);
  });

  it("describes a first version as everything it holds", () => {
    expect(profileChanges(null, { ...EMPTY_PROFILE, rules: { ...EMPTY_PROFILE.rules, minHeadcount: 5 }, sources: { min_headcount: guide } })).toEqual([
      "Minimum headcount: Not checked yet → 5",
      "Where the minimum headcount was checked: Not checked yet → Document: Broker guide 2026 · checked 20 Oct 2026",
    ]);
  });
});

describe("the parts of a profile, from one table", () => {
  it("names each part's source in a sentence, was or were by the part", () => {
    const next: EditableProfile = { ...FULL, sources: { ...FULL.sources, min_enrolment_percent: guide, answers: guide, states_served: dana } };
    expect(profileChanges(FULL, next)).toEqual([
      "Where the states served were checked: Document: Broker guide 2026 · checked 20 Oct 2026 → Broker desk: Dana Reyes, Broker desk manager · checked 2 Nov 2026",
      "Where the minimum participation was checked: Broker desk: Dana Reyes, Broker desk manager · checked 2 Nov 2026 → Document: Broker guide 2026 · checked 20 Oct 2026",
      "Where the answers were checked: Broker desk: Dana Reyes, Broker desk manager · checked 2 Nov 2026 → Document: Broker guide 2026 · checked 20 Oct 2026",
    ]);
  });

  it("shows a rule checked with nothing excluded as None", () => {
    expect(showRule({ ...EMPTY_PROFILE, rules: { ...EMPTY_PROFILE.rules, excludedClassCodes: [], excludedIndustries: [] } }, "excludedClassCodes")).toBe("None");
    expect(showRule({ ...EMPTY_PROFILE, rules: { ...EMPTY_PROFILE.rules, excludedIndustries: [] } }, "excludedIndustries")).toBe("None");
  });

  it("asks for the source of a rule checked with nothing excluded: it says something", () => {
    expect(publishProblems({ ...EMPTY_PROFILE, rules: { ...EMPTY_PROFILE.rules, excludedIndustries: [] }, sources: { documents: guide } })).toEqual([
      { path: "sources.excluded_industries", message: "Name where the excluded industries came from, and when it was checked, before publishing" },
    ]);
  });
});

describe("excluded industries and the class codes each covers", () => {
  const mapped: EditableProfile = {
    ...EMPTY_PROFILE,
    rules: { ...EMPTY_PROFILE.rules, excludedIndustries: ["Roofing", "Cannabis dispensaries"], excludedIndustryCodes: { Roofing: ["5551", "5645"] } },
    sources: { excluded_industries: guide },
  };

  it("reads and writes the PEO's wording, one per line, with the codes after a colon", () => {
    expect(industriesText(["Roofing", "Cannabis dispensaries"], { Roofing: ["5551", "5645"] })).toBe("Roofing: 5551, 5645\nCannabis dispensaries");
    expect(readIndustries("Roofing: 5551, 5645\nCannabis dispensaries\n Trucking: long haul \n")).toEqual({
      industries: ["Roofing", "Cannabis dispensaries", "Trucking: long haul"],
      codes: { Roofing: ["5551", "5645"] },
    });
  });

  it("sends the mapping as the database takes it, and reads it back", () => {
    expect(profilePayload(mapped)).toMatchObject({ excluded_industries: ["Roofing", "Cannabis dispensaries"], excluded_industry_codes: { Roofing: ["5551", "5645"] } });
    expect(profilePayload(EMPTY_PROFILE)).toMatchObject({ excluded_industry_codes: {} });
    const row = { id: 9, version: 2, status: "draft", created_at: "2026-11-01T00:00:00Z", published_at: null, ...profilePayload(mapped) };
    expect(parseProfileVersion("TriNet", row, []).profile.rules.excludedIndustryCodes).toEqual({ Roofing: ["5551", "5645"] });
  });

  it("refuses a mapping the database refuses, at the excluded industries", () => {
    const rules = (codes: Record<string, string[]>) => ({ rules: { ...EMPTY_PROFILE.rules, excludedIndustries: ["Roofing"], excludedIndustryCodes: codes } });
    const message = "Each excluded industry maps to 1 to 100 different class codes, each four digits";
    expect(problems(rules({ Roofing: ["55"] }))).toEqual([{ path: "rules.excludedIndustries", message }]);
    expect(problems(rules({ Roofing: [] }))).toEqual([{ path: "rules.excludedIndustries", message }]);
    expect(problems(rules({ Roofing: ["5551", "5551"] }))).toEqual([{ path: "rules.excludedIndustries", message }]);
    expect(problems(rules({ Roofing: Array.from({ length: 101 }, (_, i) => String(1000 + i)) }))).toEqual([{ path: "rules.excludedIndustries", message }]);
    expect(problems(rules({ Roofing: Array.from({ length: 100 }, (_, i) => String(1000 + i)) }))).toEqual([]);
    expect(problems(rules({ Mining: ["1164"] }))).toEqual([{ path: "rules.excludedIndustries", message: "Class codes are mapped only to an industry the PEO excludes, as it is worded" }]);
  });

  it("shows each industry with the codes it covers, and names a change of codes", () => {
    expect(showRule(mapped, "excludedIndustries")).toBe("Roofing (class codes 5551, 5645), Cannabis dispensaries (no class codes mapped)");
    const next = { ...mapped, rules: { ...mapped.rules, excludedIndustryCodes: { Roofing: ["5551"], "Cannabis dispensaries": ["8017"] } } };
    expect(profileChanges(mapped, next)).toEqual([
      "Excluded industries: Roofing (class codes 5551, 5645), Cannabis dispensaries (no class codes mapped) → Roofing (class code 5551), Cannabis dispensaries (class code 8017)",
    ]);
  });

  it("calls the minimum enrolment rule minimum participation", () => {
    expect(publishProblems({ ...EMPTY_PROFILE, rules: { ...EMPTY_PROFILE.rules, minEnrolmentPercent: 75 } })).toEqual([
      { path: "sources.min_enrolment_percent", message: "Name where the minimum participation came from, and when it was checked, before publishing" },
    ]);
  });
});
