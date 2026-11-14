import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyPageMeta } from "@/components/PageMeta";
import { LEGAL_COPY_APPROVED } from "@/data/legal";
import { HOME_PAGE, PRIVATE_PATH_EXAMPLES, PUBLIC_PAGES, indexablePages, pageMetaFor } from "@/data/seo";
import { SITE_ORIGIN } from "@/data/site";
import { llmsTxt, pageHtml, seoFiles, sitemapXml } from "../scripts/seoBuild";

// What search engines are told about each page (src/data/seo.ts). The table is read by the running app, the build
// and vercel.json; these tests hold the three to it, and to the routes in src/App.tsx.

const indexHtml = readFileSync("index.html", "utf8");
const metaContent = (html: string, attribute: string, key: string) =>
  new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];

describe("page meta table", () => {
  it("gives every public page its own title and a description of a length a search result can show", () => {
    expect(new Set(PUBLIC_PAGES.map((p) => p.title)).size).toBe(PUBLIC_PAGES.length);
    expect(new Set(PUBLIC_PAGES.map((p) => p.description)).size).toBe(PUBLIC_PAGES.length);
    for (const page of PUBLIC_PAGES) {
      expect(page.title.length, page.path).toBeLessThanOrEqual(60);
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(50);
      expect(page.description.length, page.path).toBeLessThanOrEqual(210);
    }
  });

  it("keeps index.html's title and description the home page's", () => {
    expect(/<title>([^<]*)<\/title>/.exec(indexHtml)?.[1]).toBe(HOME_PAGE.title);
    expect(metaContent(indexHtml, "name", "description")).toBe(HOME_PAGE.description);
  });

  it("never indexes a private page, or an address the app doesn't route", () => {
    for (const path of [...PRIVATE_PATH_EXAMPLES, "/no-such-page", "/privacy/extra"]) {
      expect(pageMetaFor(path).index, path).toBe(false);
    }
    expect(pageMetaFor("/no-such-page").title).toBe("Page not found | Nevermore");
    expect(pageMetaFor("/advisor/funnel").title).toBe("Funnel | Nevermore");
  });

  it("indexes the landing page and the sample packet, and the legal pages only once counsel has approved them", () => {
    expect(pageMetaFor("/").index).toBe(true);
    expect(pageMetaFor("/manuscript/demo").index).toBe(true);
    expect(pageMetaFor("/privacy").index).toBe(LEGAL_COPY_APPROVED);
    expect(pageMetaFor("/terms/").index).toBe(LEGAL_COPY_APPROVED);
  });

  it("covers every route in src/App.tsx", () => {
    const routes = [...readFileSync("src/App.tsx", "utf8").matchAll(/<Route\s+path="([^"]+)"/g)].map(([, path]) => path);
    expect(routes.length).toBeGreaterThan(10);
    for (const route of routes.filter((r) => r !== "*")) {
      const path = route.replace(/:\w+/g, "x1");
      expect(pageMetaFor(path).title, route).not.toBe("Page not found | Nevermore");
    }
  });
});

// Every page has its own title (story CRM-S1.1a): a tab, a bookmark and the browser's history name the page, not "Advisor Console".
describe("the title of each workspace page", () => {
  const PAGES = [
    "/settings", "/advisor", "/advisor/submissions/123", "/advisor/outbox", "/advisor/funnel", "/advisor/partners", "/advisor/peos",
    "/advisor/mailbox", "/advisor/activity", "/advisor/held", "/advisor/firms", "/firm/invitations",
  ];
  it("is different for each page and never the console's generic one", () => {
    const titles = PAGES.map((path) => pageMetaFor(path).title);
    expect(new Set(titles).size).toBe(PAGES.length);
    for (const title of titles) expect(title).not.toMatch(/Advisor Console/);
  });
  it("is private: never indexed", () => {
    for (const path of PAGES) expect(pageMetaFor(path).index, path).toBe(false);
  });
});

describe("the head the app sets", () => {
  const head = (path: string) => {
    const doc = document.implementation.createHTMLDocument("");
    doc.head.innerHTML = '<meta name="description" content="old"><meta property="og:url" content="old">';
    applyPageMeta(pageMetaFor(path), doc);
    return doc;
  };

  it("names the page and its canonical address on an indexable page", () => {
    const doc = head("/manuscript/demo");
    expect(doc.title).toBe("Sample PEO underwriting packet | Nevermore");
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${SITE_ORIGIN}/manuscript/demo`);
    expect(doc.querySelector('meta[name="robots"]')).toBeNull();
    expect(doc.querySelector('meta[name="description"]')?.getAttribute("content")).toMatch(/^See the packet/);
  });

  it("says noindex, with no canonical address, on a private page and takes both back on the way out", () => {
    const doc = head("/start");
    expect(doc.title).toBe("Your intake | Nevermore");
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull();

    applyPageMeta(pageMetaFor("/"), doc);
    expect(doc.querySelector('meta[name="robots"]')).toBeNull();
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${SITE_ORIGIN}/`);
  });
});

describe("what the build writes", () => {
  it("writes a page of its own for each public page but the home page, with that page's head", () => {
    const files = seoFiles(indexHtml);
    expect(Object.keys(files).sort()).toEqual(["llms.txt", "manuscript/demo/index.html", "privacy/index.html", "sitemap.xml", "terms/index.html"]);

    const sample = files["manuscript/demo/index.html"];
    expect(sample).toContain("<title>Sample PEO underwriting packet | Nevermore</title>");
    expect(sample).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/manuscript/demo">`);
    expect(metaContent(sample, "property", "og:url")).toBe(`${SITE_ORIGIN}/manuscript/demo`);
    expect(metaContent(sample, "property", "og:title")).toBe("Sample PEO underwriting packet | Nevermore");
    expect(metaContent(sample, "name", "description")).toMatch(/^See the packet a PEO.s underwriters receive/);
    // The app itself is untouched.
    expect(sample).toContain('<div id="root"></div>');
  });

  it("marks a page that isn't indexable noindex, and gives it no canonical address", () => {
    const html = pageHtml(indexHtml, { path: "/terms", title: "T", description: 'A "quoted" <desc>', index: false });
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toMatch(/rel="canonical"/);
    expect(html).toContain('content="A &quot;quoted&quot; &lt;desc&gt;"');
  });

  it("lists exactly the indexable pages in the sitemap and llms.txt, on the production domain", () => {
    const locs = [...sitemapXml().matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
    expect(locs).toEqual(indexablePages().map((p) => `${SITE_ORIGIN}${p.path}`));
    expect(locs).toContain(`${SITE_ORIGIN}/`);
    for (const path of PRIVATE_PATH_EXAMPLES) expect(locs).not.toContain(`${SITE_ORIGIN}${path}`);
    for (const loc of locs) expect(llmsTxt()).toContain(`(${loc})`);
  });

  it("points robots.txt at the sitemap", () => {
    expect(readFileSync("public/robots.txt", "utf8")).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });
});

// An invitation's secret travels after the # of its link (D-34): a browser never sends that to a server, so it reaches no request
// log and no Referer. That holds only while no route, rewrite or redirect has a place for a secret in the path.
describe("an invitation's link (D-34)", () => {
  it("has a route with no parameter, so nothing under /join is a route and no path holds a secret", () => {
    const routes = [...readFileSync("src/App.tsx", "utf8").matchAll(/<Route\s+path="([^"]+)"/g)].map(([, path]) => path);
    expect(routes).toContain("/join");
    expect(routes.filter((r) => r.startsWith("/join") && r !== "/join")).toEqual([]);
    expect(pageMetaFor("/join/a-secret-in-a-path").title).toBe("Page not found | Nevermore");
  });

  it("is not sent anywhere by a rewrite or redirect that names a token", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { rewrites?: { source: string; destination: string }[]; redirects?: unknown[] };
    expect(JSON.stringify([config.rewrites, config.redirects])).not.toMatch(/token|join/i);
  });
});

describe("X-Robots-Tag (vercel.json)", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const rules = config.headers.filter((rule) => rule.headers.some((h) => h.key === "X-Robots-Tag" && h.value === "noindex"));
  // The rule's source is written so that it is also a plain regular expression (no named parameters).
  const noindex = (path: string) => rules.some((rule) => new RegExp(`^${rule.source}$`).test(path));

  it("tells crawlers that don't run scripts not to index the private routes", () => {
    expect(rules).toHaveLength(1);
    expect(rules[0].source).not.toMatch(/:\w/);
    for (const path of PRIVATE_PATH_EXAMPLES) expect(noindex(path), path).toBe(true);
  });

  it("leaves the public pages, the sitemap and the assets alone", () => {
    for (const path of [...PUBLIC_PAGES.map((p) => p.path), "/sitemap.xml", "/robots.txt", "/llms.txt", "/assets/index.js", "/starting"]) {
      expect(noindex(path), path).toBe(false);
    }
  });
});

describe("structured data (index.html)", () => {
  it("names the site and its operator on the production domain", () => {
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(indexHtml)?.[1];
    const graph = (JSON.parse(json!) as { "@graph": Record<string, unknown>[] })["@graph"];
    const website = graph.find((node) => node["@type"] === "WebSite")!;
    const organization = graph.find((node) => node["@type"] === "Organization")!;
    expect(website.name).toBe("Nevermore");
    expect(website.url).toBe(`${SITE_ORIGIN}/`);
    expect(organization.name).toBe("Edgar Allan Advisory");
    expect(website.publisher).toEqual({ "@id": organization["@id"] });
    expect(String(organization.logo).startsWith(`${SITE_ORIGIN}/`)).toBe(true);
  });
});
