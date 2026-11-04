import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Private files stay private (US-6.3, docs/SECURITY_REVIEW.md): a stored file is only ever reached through a
// signed link that expires within a minute, issued by Supabase Storage only to a caller its row security
// lets read the file (supabase/tests/data_isolation.sql checks who that is). These checks keep the code to
// that: no public links, one place that signs, a short expiry, and a link that is used at once and never
// kept, logged or put in the app's own URLs.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const APP = sourceFiles("src");
const FUNCTIONS = sourceFiles("supabase/functions");
const read = (file: string) => readFileSync(file, "utf8");
// Read from the source: importing advisorApi.ts would build a Supabase client.
const SIGNED_URL_SECONDS = Number(/export const SIGNED_URL_SECONDS = (\d+);/.exec(read(join("src", "lib", "advisorApi.ts")))?.[1]);

describe("private file links", () => {
  it("finds the code it checks", () => {
    expect(APP).toContain(join("src", "lib", "advisorApi.ts"));
    expect(FUNCTIONS.length).toBeGreaterThan(10);
  });

  it("never asks for a public link, in the app or an edge function", () => {
    for (const file of [...APP, ...FUNCTIONS]) {
      expect(read(file), file).not.toMatch(/getPublicUrl|\/storage\/v1\/object\/public\//);
    }
  });

  it("signs links in one place, src/lib/advisorApi.ts, and nowhere else", () => {
    const signers = [...APP, ...FUNCTIONS].filter((file) => /createSigned(Upload)?Urls?\b/.test(read(file)));
    expect(signers).toEqual([join("src", "lib", "advisorApi.ts")]);
    const calls = read(join("src", "lib", "advisorApi.ts")).match(/createSigned\w*\(/g) ?? [];
    expect(calls).toEqual(["createSignedUrl("]);
  });

  it("makes every link expire within a minute", () => {
    expect(SIGNED_URL_SECONDS).toBeGreaterThan(0);
    expect(SIGNED_URL_SECONDS).toBeLessThanOrEqual(60);
    // The one call passes the constant, not a literal that could drift from it.
    expect(read(join("src", "lib", "advisorApi.ts"))).toMatch(/\.createSignedUrl\(path, SIGNED_URL_SECONDS,/);
  });

  // E-4.1: every link asks Storage for Content-Disposition: attachment, so a browser saves the file rather than
  // showing it. The download parameter isn't part of what Storage signs, so documents are also stored as
  // application/octet-stream (document-upload, document-scan), which a browser never shows inline.
  it("makes every link a download, under a cleaned name", () => {
    const api = read(join("src", "lib", "advisorApi.ts"));
    const signer = api.slice(api.indexOf("async function signedUrl"), api.indexOf("export const documentUrl"));
    // The name is required, and always sent.
    expect(signer).toMatch(/async function signedUrl\(bucket: "documents" \| "manuscripts", path: string, download: string\)/);
    expect(signer).toMatch(/\.createSignedUrl\(path, SIGNED_URL_SECONDS, \{ download: downloadName\(download\) \}\)/);
    for (const maker of ["documentUrl", "manuscriptUrl", "finalManuscriptUrl"]) {
      const line = api.split("\n").find((l) => l.startsWith(`export const ${maker} =`)) ?? "";
      const body = line + api.slice(api.indexOf(line) + line.length).split("\n")[1];
      expect(body, maker).toMatch(/signedUrl\("(documents|manuscripts)", [\w.]+, \w+(\.file_name)?\)/);
    }
    for (const file of FUNCTIONS.filter((f) => /document-(upload|scan)/.test(f))) {
      const text = read(file);
      for (const call of text.match(/\.upload\([^)]*\)/g) ?? []) expect(call, file).toContain("contentType: STORED_CONTENT_TYPE");
    }
  });

  it("uses a link at once and never keeps, logs or routes it", () => {
    const linkMakers = /\b(documentUrl|manuscriptUrl|finalManuscriptUrl)\(/;
    const users = APP.filter((file) => !file.endsWith(join("lib", "advisorApi.ts")) && linkMakers.test(read(file)));
    expect(users.sort()).toEqual([
      join("src", "components", "advisor", "DocumentsPanel.tsx"),
      join("src", "components", "advisor", "ManuscriptPanel.tsx"),
      join("src", "pages", "ManuscriptPage.tsx"),
    ]);
    for (const file of users) {
      const text = read(file);
      // Each link goes straight to the browser, which downloads it; nothing holds on to it.
      for (const line of text.split("\n").filter((l) => linkMakers.test(l))) {
        expect(line.trim(), file).toMatch(/^window\.location\.assign\(await (documentUrl|manuscriptUrl|finalManuscriptUrl)\(/);
      }
      expect(text, file).not.toMatch(/localStorage|sessionStorage|indexedDB|navigate\(|setSearchParams|history\.(push|replace)State/);
      expect(text, file).not.toMatch(/console\.\w+\([^)]*(url|Url|link)/);
    }
  });

  it("keeps the signed link itself out of logs and errors", () => {
    const api = read(join("src", "lib", "advisorApi.ts"));
    const signer = api.slice(api.indexOf("async function signedUrl"), api.indexOf("export const documentUrl"));
    expect(signer).not.toMatch(/console\./);
    // A failure reports a fixed message, not the path or the link.
    expect(signer).toMatch(/fail\(error, "Couldn't open that file\."\)/);
  });

  it("creates no public bucket in any migration", () => {
    const dir = "supabase/migrations";
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      const sql = read(join(dir, file));
      for (const insert of sql.match(/INSERT INTO storage\.buckets[\s\S]*?;/gi) ?? []) {
        expect(insert, file).toMatch(/,\s*false\s*\)/);
        expect(insert, file).not.toMatch(/,\s*true\s*\)/);
      }
      expect(sql, file).not.toMatch(/UPDATE\s+storage\.buckets\s+SET[^;]*public\s*=\s*true/i);
    }
  });
});
