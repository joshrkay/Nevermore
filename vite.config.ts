import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

import { missingSupabaseEnvMessage, resolveSupabaseEnv } from "./scripts/buildEnv";
import { seoPages } from "./scripts/seoBuild";

// The Supabase URL and publishable key the app is built with (scripts/buildEnv.ts takes the
// NEXT_PUBLIC_SUPABASE_* names Vercel's integration sets as well as the VITE_* ones). Without them
// the app builds and then shows a blank page, so a Vercel build that has neither fails here, which
// keeps a broken site from replacing the working one. Other builds (CI, local) are left alone.
function supabaseEnv(mode: string, command: string) {
  const { define, missing } = resolveSupabaseEnv(loadEnv(mode, process.cwd(), ""));
  if (command === "build" && process.env.VERCEL && missing.length > 0) {
    throw new Error(missingSupabaseEnvMessage(missing));
  }
  return define;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: supabaseEnv(mode, command),
  // seoPages: a head for each public page, sitemap.xml and llms.txt (scripts/seoBuild.ts).
  plugins: [react(), mode === "development" && componentTagger(), seoPages()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
