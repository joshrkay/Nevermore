import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// docs/ROUTE_ACCESS.md says who can open every route in src/App.tsx and what protects its data (plan F-0.3).
// A route added to the app, or removed from it, without the table following fails here.

const appRoutes = (): string[] => {
  const app = readFileSync("src/App.tsx", "utf8");
  return [...app.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g)].map((m) => m[1]);
};

// The first cell of each table row, when it is a route in backticks: "| `/advisor` | ...".
const documentedRoutes = (): string[] => {
  const doc = readFileSync("docs/ROUTE_ACCESS.md", "utf8");
  return [...doc.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
};

describe("docs/ROUTE_ACCESS.md", () => {
  it("finds the app's routes", () => {
    // Guards the parsing itself: if App.tsx stops declaring routes this way, the checks below would pass vacuously.
    expect(appRoutes()).toEqual(expect.arrayContaining(["/", "/start", "/advisor", "*"]));
  });

  it("documents every route in src/App.tsx", () => {
    const documented = new Set(documentedRoutes());
    expect(appRoutes().filter((path) => !documented.has(path))).toEqual([]);
  });

  it("documents no route src/App.tsx doesn't have", () => {
    const routes = new Set(appRoutes());
    expect(documentedRoutes().filter((path) => !routes.has(path))).toEqual([]);
  });

  it("lists each route once", () => {
    const documented = documentedRoutes();
    expect(documented.filter((path, i) => documented.indexOf(path) !== i)).toEqual([]);
  });
});
