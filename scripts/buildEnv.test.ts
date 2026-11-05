import { describe, expect, it } from "vitest";
import { missingSupabaseEnvMessage, resolveSupabaseEnv } from "./buildEnv";

const URL_VALUE = "https://abc.supabase.co";
const KEY_VALUE = "publishable-key";

describe("resolveSupabaseEnv", () => {
  it("needs nothing from the build when the VITE_* names are set", () => {
    expect(resolveSupabaseEnv({ VITE_SUPABASE_URL: URL_VALUE, VITE_SUPABASE_PUBLISHABLE_KEY: KEY_VALUE })).toEqual({
      define: {},
      missing: [],
    });
  });

  it("takes the names Vercel's Supabase integration sets", () => {
    const { define, missing } = resolveSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: URL_VALUE,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_VALUE,
    });
    expect(missing).toEqual([]);
    expect(define).toEqual({
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(URL_VALUE),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(KEY_VALUE),
    });
  });

  it("falls back to the anon key when there is no publishable key", () => {
    const { define, missing } = resolveSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_VALUE, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" });
    expect(missing).toEqual([]);
    expect(define["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"]).toBe(JSON.stringify("anon"));
  });

  it("prefers the VITE_* value to the integration's", () => {
    const { define } = resolveSupabaseEnv({
      VITE_SUPABASE_URL: URL_VALUE,
      NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: KEY_VALUE,
    });
    expect(define).toEqual({});
  });

  it("reports what neither the name nor a fallback supplies", () => {
    expect(resolveSupabaseEnv({}).missing).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
    expect(resolveSupabaseEnv({ VITE_SUPABASE_URL: URL_VALUE }).missing).toEqual(["VITE_SUPABASE_PUBLISHABLE_KEY"]);
  });

  it("counts an empty value as missing", () => {
    expect(resolveSupabaseEnv({ VITE_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: KEY_VALUE }).missing).toEqual([
      "VITE_SUPABASE_URL",
    ]);
  });

  it("never takes a secret: only the browser-safe names are read", () => {
    const { define } = resolveSupabaseEnv({
      SUPABASE_SERVICE_ROLE_KEY: "secret",
      SUPABASE_URL: URL_VALUE,
      POSTGRES_PASSWORD: "secret",
    });
    expect(JSON.stringify(define)).not.toContain("secret");
    expect(define).toEqual({});
  });
});

describe("missingSupabaseEnvMessage", () => {
  it("names the missing settings, the alternatives and the guide", () => {
    const message = missingSupabaseEnvMessage(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
    expect(message).toContain("VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
    expect(message).toContain("VITE_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
    expect(message).toContain("blank page");
    expect(message).toContain("docs/SUPABASE_SETUP.md");
  });
});
