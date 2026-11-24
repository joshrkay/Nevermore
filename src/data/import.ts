// Importing a book from a CSV (CRM-X4.1; docs/BROKER_READINESS_PRD.md BR-5.1): reading the file, proposing which column is which field, and turning its rows
// into what the database is sent. The database decides what each row makes (20261130090000_import.sql); nothing here contacts anyone or stores the file.

/** The limits, as the database has them (public.import_limits; src/data/import.test.ts holds the two equal). */
export const IMPORT_LIMITS = { max_rows: 10000, max_rows_a_request: 500, undo_days: 30 } as const;

export type ImportKind = "leads" | "accounts";
export const IMPORT_KIND_LABELS: Record<ImportKind, string> = { leads: "Leads", accounts: "Accounts with their contacts" };

export interface ImportField {
  /** The name the database reads the value under. */
  key: string;
  label: string;
  /** Headers a file might call it, lower case with nothing but letters and digits. The field's own label is always one. */
  also: string[];
  required?: boolean;
}

const f = (key: string, label: string, also: string[] = [], required = false): ImportField => ({ key, label, also, required });

// No field holds a tax ID, a census or anything about an employee: those stay in the intake, which the employer owns (docs/BROKER_CRM_PRD.md section 7).
export const IMPORT_FIELDS: Record<ImportKind, ImportField[]> = {
  leads: [
    f("name", "Name", ["fullname", "contact", "contactname", "leadname", "person"], true),
    f("title", "Title", ["jobtitle", "role", "position"]),
    f("business", "Business", ["company", "companyname", "employer", "organization", "organisation", "account"]),
    f("email", "Email", ["emailaddress", "workemail"]),
    f("phone", "Phone", ["phonenumber", "telephone", "workphone", "mobile", "cell"]),
    f("city", "City", ["town"]),
    f("state", "State", ["st", "province", "region"]),
    f("employees", "Employees", ["employeecount", "headcount", "numberofemployees", "ofemployees", "noofemployees", "numemployees", "totalemployees", "ftes", "size", "ees"]),
    f("current_provider", "Current provider", ["currentpeo", "peo", "provider", "currentcarrier", "carrier", "incumbent"]),
    f("note", "Note", ["notes", "comments", "comment", "description"]),
    f("owner", "Owner", ["assignedto", "agent", "rep", "salesrep", "owneremail"]),
  ],
  accounts: [
    f("name", "Business name", ["name", "company", "companyname", "account", "accountname", "legalname", "employer", "business"], true),
    f("trade_name", "Trade name", ["dba", "doingbusinessas", "tradename"]),
    f("website", "Website", ["url", "web", "domain", "site"]),
    f("phone", "Phone", ["phonenumber", "telephone", "mainphone", "businessphone"]),
    f("street", "Street", ["address", "address1", "streetaddress", "addressline1"]),
    f("city", "City", ["town"]),
    f("state", "State", ["st", "province", "region"]),
    f("postal_code", "ZIP code", ["zip", "zipcode", "postalcode", "postcode"]),
    f("industry", "Industry", ["sector", "vertical"]),
    f("employees", "Employees", ["employeecount", "headcount", "numberofemployees", "ofemployees", "noofemployees", "numemployees", "totalemployees", "ftes", "size", "ees"]),
    f("current_provider", "Current provider", ["currentpeo", "peo", "provider", "currentcarrier", "carrier", "incumbent"]),
    f("renewal_date", "Renewal date", ["renewal", "renews", "renewson", "renewaldate", "expiration", "expirationdate", "xdate"]),
    f("owner", "Owner", ["assignedto", "agent", "rep", "salesrep", "owneremail", "accountowner"]),
    f("contact_first_name", "Contact first name", ["firstname", "first", "contactfirst", "givenname"]),
    f("contact_last_name", "Contact last name", ["lastname", "last", "contactlast", "surname", "familyname"]),
    f("contact_title", "Contact title", ["title", "jobtitle", "contacttitle", "position"]),
    f("contact_email", "Contact email", ["email", "emailaddress", "contactemail", "workemail"]),
    f("contact_phone", "Contact phone", ["contactphone", "directphone", "workphone"]),
    f("contact_mobile", "Contact mobile", ["mobile", "cell", "cellphone", "mobilephone"]),
  ],
};

export type ReadFile = { ok: true; headers: string[]; rows: string[][] } | { ok: false; problem: string };

/**
 * A CSV's text as rows of fields (RFC 4180): quoted fields may hold commas, line breaks and doubled quotes; a byte-order mark and blank lines are dropped.
 * A file whose first line has one field and a semicolon or a tab in it is read with that as its separator (a spreadsheet set to another locale writes those).
 */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^\uFEFF/, "");
  const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
  const separator = !firstLine.includes(",") && firstLine.includes(";") ? ";" : !firstLine.includes(",") && firstLine.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === separator) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** A file as its header row and the rows under it, or what is wrong with it and what a file needs. */
export function readImportFile(text: string): ReadFile {
  // A spreadsheet saved as itself, a PDF or an image is not text: it starts with a signature and holds control characters.
  // eslint-disable-next-line no-control-regex
  if (/^(PK|%PDF|\u0089PNG)/.test(text) || /[\u0000-\u0008]/.test(text.slice(0, 2000))) {
    return { ok: false, problem: "That file isn't a CSV. In your spreadsheet, choose Save as or Download, pick CSV, and choose that file." };
  }
  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: false, problem: "That file is empty. A file needs a row of column names and at least one row under it." };
  const headers = rows[0].map((h) => h.trim());
  if (rows.length === 1) return { ok: false, problem: "The file has column names and no rows under them." };
  if (rows.length - 1 > IMPORT_LIMITS.max_rows) {
    return { ok: false, problem: `The file has ${(rows.length - 1).toLocaleString("en-US")} rows. An import holds at most ${IMPORT_LIMITS.max_rows.toLocaleString("en-US")}: split the file and import each part.` };
  }
  return { ok: true, headers, rows: rows.slice(1) };
}

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Which field each column is, proposed from its name: a field's key for a column that reads as it, null ("Don't import") otherwise. A field is proposed once, for the first column that reads as it. */
export function proposeMatches(kind: ImportKind, headers: string[]): (string | null)[] {
  const taken = new Set<string>();
  // An exact reading of the field's own label or key wins over a looser name, whichever column comes first.
  const exact = headers.map((h) => IMPORT_FIELDS[kind].find((x) => plain(x.label) === plain(h) || plain(x.key) === plain(h))?.key ?? null);
  return headers.map((h, i) => {
    const key = exact[i] ?? IMPORT_FIELDS[kind].find((x) => x.also.includes(plain(h)) && !exact.includes(x.key))?.key ?? null;
    if (!key || taken.has(key)) return null;
    taken.add(key);
    return key;
  });
}

/** What stops the matching being used, in words; null when it can be. */
export function matchingProblem(kind: ImportKind, matches: (string | null)[]): string | null {
  const used = matches.filter((m): m is string => m !== null);
  const twice = IMPORT_FIELDS[kind].find((x) => used.filter((u) => u === x.key).length > 1);
  if (twice) return `Two columns are matched to ${twice.label}. Match one of them to something else, or to Don't import.`;
  const missing = IMPORT_FIELDS[kind].find((x) => x.required && !used.includes(x.key));
  return missing ? `Match a column to ${missing.label}: every row needs one.` : null;
}

export type ImportRow = Record<string, string | number>;

/** The file's rows as the database is sent them: each matched column under its field's name, and the row's own number in the file (the header is row 1). */
export function buildRows(rows: string[][], matches: (string | null)[]): ImportRow[] {
  return rows.map((r, i) => {
    const out: ImportRow = { _row: i + 2 };
    matches.forEach((key, c) => {
      if (key && (r[c] ?? "").trim() !== "") out[key] = r[c].trim();
    });
    return out;
  });
}

/** The rows in pieces no larger than one request may hold. */
export function chunks<T>(rows: T[], size: number = IMPORT_LIMITS.max_rows_a_request): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export interface ImportProblem { row: number; outcome: "exists" | "failed"; reason: string | null }
export interface ImportCounts { created: number; exists: number; failed: number }
