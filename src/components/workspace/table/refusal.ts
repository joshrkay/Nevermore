/**
 * The database's refusals of a query it won't run: a filter, sort, page, view or time zone it doesn't take (22023), and a filter on a
 * person until records have an owner (0A000). Each carries a reason written for people (they name a field, an operator or a limit and
 * echo at most 64 characters of what was sent; none holds anything of the firm's data), so the frame shows it as it is. Every other
 * failure is "something went wrong", with a retry.
 */
const REFUSED_QUERY_CODES = ["22023", "0A000"];

/** The reason, when this error is the database refusing the query itself; null for any other failure. */
export function refusedQueryReason(error: unknown): string | null {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return typeof code === "string" && REFUSED_QUERY_CODES.includes(code) && typeof message === "string" && message.trim() !== "" ? message : null;
}
