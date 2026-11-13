/** What a server function said when it refused or failed (its JSON `error` field) and the status it answered with; each is null when the reply can't be read. */
export async function functionErrorReply(error: { context?: unknown }): Promise<{ reason: string | null; status: number | null }> {
  const context = error.context;
  if (!(context instanceof Response)) return { reason: null, status: null };
  const body = (await context.json().catch(() => null)) as { error?: unknown } | null;
  return { reason: typeof body?.error === "string" ? body.error : null, status: context.status };
}
