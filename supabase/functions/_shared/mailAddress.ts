// The one address rule (story CRM-E1.2a, D-637): a bare address, with no name, no space and no bracket or separator a header could be split on.
// The database holds the same pattern (public.is_mail_address, 20261122090000_conversations.sql) and src/data/schemaSync.test.ts compares
// them, so what the database took is what the message builder puts in a header. No imports, so it runs under Deno and Vitest alike.

export const MAIL_ADDRESS_PATTERN = new RegExp(String.raw`^[^\s@<>,;"()\[\]\\]+@[^\s@<>,;"()\[\]\\]+\.[^\s@<>,;"()\[\]\\]+$`);

/** Whether a value is an address the builder may put in a header: the pattern, and at most 254 characters, as the database asks. */
export const isMailAddress = (value: unknown): value is string => typeof value === "string" && value.length <= 254 && MAIL_ADDRESS_PATTERN.test(value);
