// Who may ask for a dispatch run. No imports, so it runs under Deno and Vitest alike.

export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/** Compares secrets without stopping at the first differing character. */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** True when the request carries the project's service-role key (the scheduled sweep). */
export function isServiceCall(authorization: string | null, serviceRoleKey: string): boolean {
  const token = bearerToken(authorization);
  return token !== null && serviceRoleKey !== "" && sameSecret(token, serviceRoleKey);
}
