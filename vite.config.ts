import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Vercel's Supabase integration provides the project's URL and publishable key as
// NEXT_PUBLIC_SUPABASE_*, not the VITE_* names this app reads. Fall back to those two (and only
// those: they are browser-safe, unlike the SUPABASE_SERVICE_ROLE_KEY and POSTGRES_* variables
// the integration also sets, which must never reach the bundle).
const FALLBACKS: Record<string, string[]> = {
  VITE_SUPABASE_URL: ["NEXT_PUBLIC_SUPABASE_URL"],
  VITE_SUPABASE_PUBLISHABLE_KEY: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
};

function supabaseEnvFallbacks(mode: string) {
  const env = loadEnv(mode, process.cwd(), "");
  const define: Record<string, string> = {};
  for (const [name, fallbacks] of Object.entries(FALLBACKS)) {
    if (env[name]) continue;
    const value = fallbacks.map((key) => env[key]).find(Boolean);
    if (value) define[`import.meta.env.${name}`] = JSON.stringify(value);
  }
  return define;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: supabaseEnvFallbacks(mode),
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
