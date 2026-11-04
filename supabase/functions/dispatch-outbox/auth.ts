// Who may ask for a dispatch run. The check itself is shared with the other scheduled functions
// (purge-intakes, ops-monitor) in ../_shared/serviceAuth.ts; it is re-exported here so this function's
// imports, its tests and the e2e stand-in keep working unchanged. No remote imports, so it runs under
// Deno, Node's type stripping and Vitest alike.

export { bearerToken, isServiceCall, sameSecret } from "../_shared/serviceAuth.ts";
