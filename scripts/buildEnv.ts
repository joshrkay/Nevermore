// The Supabase settings the front end is built with. src/integrations/supabase/client.ts reads
// VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY and throws "supabaseUrl is required." as the
// app loads, so a site built without them builds fine and then shows a blank page. vite.config.ts
// uses this to take the names Vercel's Supabase integration sets, and to fail a Vercel build that
// has neither.

// Vercel's Supabase integration provides the project's URL and publishable key as
// NEXT_PUBLIC_SUPABASE_*, not the VITE_* names this app reads. Fall back to those (and only those:
// they are browser-safe, unlike the SUPABASE_SERVICE_ROLE_KEY and POSTGRES_* variables the
// integration also sets, which must never reach the bundle).
export const SUPABASE_ENV_FALLBACKS: Record<string, string[]> = {
  VITE_SUPABASE_URL: ["NEXT_PUBLIC_SUPABASE_URL"],
  VITE_SUPABASE_PUBLISHABLE_KEY: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
};

type Env = Record<string, string | undefined>;

export interface SupabaseEnv {
  /** `import.meta.env.<name>` values to define: the fallback's value for each VITE_* name that is unset. */
  define: Record<string, string>;
  /** The VITE_* names that neither the name itself nor a fallback supplies. */
  missing: string[];
}

export function resolveSupabaseEnv(env: Env): SupabaseEnv {
  const define: Record<string, string> = {};
  const missing: string[] = [];
  for (const [name, fallbacks] of Object.entries(SUPABASE_ENV_FALLBACKS)) {
    if (env[name]) continue;
    const value = fallbacks.map((key) => env[key]).find(Boolean);
    if (value) define[`import.meta.env.${name}`] = JSON.stringify(value);
    else missing.push(name);
  }
  return { define, missing };
}

/** What a failed build says: which settings are missing, where to set them, and why it matters. */
export function missingSupabaseEnvMessage(missing: string[]): string {
  const alternatives = missing.map((name) => `${name} (or ${SUPABASE_ENV_FALLBACKS[name].join(" / ")})`).join(", ");
  return [
    `Supabase is not configured for this build: ${alternatives} is not set.`,
    "A site built without them shows a blank page, because the app throws \"supabaseUrl is required.\" as it loads.",
    "Set them for Production and Preview in the Vercel project (Settings -> Environment Variables), or connect the",
    "Supabase integration to this project, then redeploy. See \"Moving to a new domain or Vercel project\" in docs/SUPABASE_SETUP.md.",
  ].join("\n");
}
