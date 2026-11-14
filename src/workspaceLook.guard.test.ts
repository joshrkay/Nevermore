import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The workspace's grey-and-blue look (story CRM-S1.1a, D-41) lives in two files read as text: the colours in src/index.css and
// their names in tailwind.config.ts. The employer's intake and the landing page keep the colours they have.
describe("the workspace colours", () => {
  const css = readFileSync("src/index.css", "utf8");
  it("are set under .theme-workspace, including the menu's, and not on :root, so the intake and the landing page keep theirs", () => {
    const workspace = /\.theme-workspace\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    for (const token of ["--background", "--primary", "--sidebar-background", "--sidebar-accent", "--sidebar-ring"]) expect(workspace, token).toContain(`${token}:`);
    expect(/:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "").not.toContain("--sidebar");
  });
  it("are known to tailwind as the sidebar's colours", () => {
    expect(readFileSync("tailwind.config.ts", "utf8")).toMatch(/sidebar:\s*\{[^}]*--sidebar-background/);
  });
});
