import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// docs/ROUTE_ACCESS.md says who can open every route in src/App.tsx and what protects its data (plan F-0.3).
// A route added to the app, or removed from it, without the table following fails here.

// A route's path, wherever it sits among the tag's attributes: path="/x", or path={"/x"} ('/x' and `/x` too).
const PATH_ATTRIBUTE = /\bpath=(?:"([^"]*)"|\{\s*(["'`])([^"'`]*)\2\s*\})/g;
const routePaths = (source: string): string[] => [...source.matchAll(PATH_ATTRIBUTE)].map((m) => m[1] ?? m[3]);
// <Route, not <Routes.
const routeTagCount = (source: string): number => (source.match(/<Route\b/g) ?? []).length;

const app = () => readFileSync("src/App.tsx", "utf8");
const appRoutes = (): string[] => routePaths(app());

// The first cell of each table row, when it is a route in backticks: "| `/advisor` | ...".
const documentedRoutes = (): string[] => {
  const doc = readFileSync("docs/ROUTE_ACCESS.md", "utf8");
  return [...doc.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
};

describe("reading routes", () => {
  it("finds a path whatever order the attributes come in, and however the string is written", () => {
    const source = [
      `<Route path="/a" element={<A />} />`,
      `<Route element={<RequireAdvisor><B /></RequireAdvisor>} path="/b" />`,
      `<Route path={"/c"} element={<C />} />`,
      `<Route element={<D />} path={'/d'} />`,
      "<Route path={`/e`} element={<E />} />",
    ].join("\n");
    expect(routePaths(source)).toEqual(["/a", "/b", "/c", "/d", "/e"]);
    expect(routeTagCount(source)).toBe(5);
  });

  it("can't read a path held in a variable, so the count check below catches it", () => {
    const source = `<Routes>\n<Route path={ADMIN_PATH} element={<X />} />\n</Routes>`;
    expect(routePaths(source)).toEqual([]);
    expect(routeTagCount(source)).toBe(1);
  });
});

describe("docs/ROUTE_ACCESS.md", () => {
  it("finds the app's routes", () => {
    // Guards the parsing itself: if App.tsx stops declaring routes this way, the checks below would pass vacuously.
    expect(appRoutes()).toEqual(expect.arrayContaining(["/", "/start", "/advisor", "*"]));
  });

  it("reads the path of every <Route> in src/App.tsx", () => {
    // A route whose path this can't read (a variable, a computed value) would otherwise go unchecked.
    expect(appRoutes()).toHaveLength(routeTagCount(app()));
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
