// Where an intake came from (plan J-2.3, decision D43): the referral code and campaign tags of the link a visitor
// followed to the site, so the advisors' funnel can count each channel (docs/GO_TO_MARKET.md, section 7).
//
// * Read from the address of the page a visitor lands on: `ref` (a referral partner's code) and `utm_source`,
//   `utm_medium` and `utm_campaign`. Each is tidied into a short code (lowercase letters, digits, dots, hyphens and
//   underscores, at most 64 characters) or dropped. The database refuses anything else (public.is_source_code,
//   migration 20261106100000; src/data/schemaSync.test.ts holds the two patterns equal).
// * Kept in this browser for SOURCE_MAX_AGE_MS, so a visitor who follows a partner's link today and starts an intake
//   next week still counts for that partner. A later link with any code replaces it: the last tagged link counts.
// * Sent once, with the intake when it is created. The database never lets it change afterwards.
// * It identifies nobody: everyone who follows the same link carries the same codes.
// * Browser storage can be missing, blocked or full. Every call here then quietly does nothing.

export const SOURCE_KEY = "eaa.intake-source.v1";
export const SOURCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** The longest code kept. */
export const SOURCE_CODE_MAX = 64;
/** A well-formed code: the database's public.is_source_code() holds the same pattern. */
export const SOURCE_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** The intake columns the source fills; null where the link carried no such code. */
export interface IntakeSource {
  referral_code: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

const FIELDS = ["referral_code", "utm_source", "utm_medium", "utm_campaign"] as const;
/** The address parameter each column is read from. */
const PARAM: Record<(typeof FIELDS)[number], string> = {
  referral_code: "ref",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_campaign: "utm_campaign",
};

/**
 * A link's code as the database keeps it, or null when nothing usable is left. Case is folded, accents are dropped,
 * runs of spaces become one hyphen, and anything else outside the allowed characters is removed.
 */
export function cleanSourceCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[._-]+/, "")
    .slice(0, SOURCE_CODE_MAX);
  return SOURCE_CODE_PATTERN.test(code) ? code : null;
}

export const hasSource = (source: IntakeSource): boolean => FIELDS.some((f) => source[f] !== null);

/** The codes in a page address's query (`?ref=…&utm_source=…`), or null when it carries none. */
export function sourceFromSearch(search: string): IntakeSource | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const source = Object.fromEntries(FIELDS.map((f) => [f, cleanSourceCode(params.get(PARAM[f]))])) as unknown as IntakeSource;
  return hasSource(source) ? source : null;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Some browsers throw on the property itself when site data is blocked.
    return null;
  }
}

/** Keeps a link's codes in this browser, replacing any kept before. */
export function rememberSource(source: IntakeSource, now: Date = new Date()): void {
  if (!hasSource(source)) return;
  try {
    storage()?.setItem(SOURCE_KEY, JSON.stringify({ ...source, savedAt: now.toISOString() }));
  } catch {
    // Full or refused: the intake simply has no source.
  }
}

/**
 * The codes kept in this browser, if they are younger than SOURCE_MAX_AGE_MS. Read as untrusted input: a value that
 * isn't a well-formed code is dropped, and an old or unreadable copy is removed.
 */
export function recalledSource(now: Date = new Date()): IntakeSource | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(SOURCE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const forget = () => {
    try {
      store.removeItem(SOURCE_KEY);
    } catch {
      // Nothing more to do.
    }
  };
  let kept: unknown;
  try {
    kept = JSON.parse(raw);
  } catch {
    forget();
    return null;
  }
  if (typeof kept !== "object" || kept === null || Array.isArray(kept)) {
    forget();
    return null;
  }
  const record = kept as Record<string, unknown>;
  const savedAt = typeof record.savedAt === "string" ? Date.parse(record.savedAt) : NaN;
  const age = now.getTime() - savedAt;
  if (!Number.isFinite(age) || age < 0 || age > SOURCE_MAX_AGE_MS) {
    forget();
    return null;
  }
  const source = Object.fromEntries(
    FIELDS.map((f) => [f, cleanSourceCode(record[f]) === record[f] ? (record[f] as string) : null]),
  ) as unknown as IntakeSource;
  return hasSource(source) ? source : null;
}

/** Called once as the app loads: keeps the codes of the link the visitor arrived by, if it carries any. */
export function captureIntakeSource(search: string, now: Date = new Date()): void {
  const source = sourceFromSearch(search);
  if (source) rememberSource(source, now);
}

/** The columns to send when creating an intake: only the codes there are, so an intake with no source sends none. */
export function intakeSourceColumns(source: IntakeSource | null): Partial<IntakeSource> {
  if (!source) return {};
  return Object.fromEntries(FIELDS.filter((f) => source[f] !== null).map((f) => [f, source[f]])) as Partial<IntakeSource>;
}
