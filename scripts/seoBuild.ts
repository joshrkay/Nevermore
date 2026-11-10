// What the build adds for search engines (src/data/seo.ts is the table it works from):
//   - <page>/index.html for each public page other than the home page: the built index.html with that page's title,
//     description, canonical address and robots rule already in the head. Vercel serves a file before it falls back
//     to the rewrite to /index.html, so a crawler that doesn't run scripts (link previews, most AI crawlers) reads
//     the right head for /privacy, /terms and the sample packet. The body is the same app.
//   - sitemap.xml: the indexable pages.
//   - llms.txt: a plain-text summary of the site and its indexable pages.
// The home page's own index.html is left alone: it is also what every private route is served, so it carries no
// canonical link (src/copy.guard.test.ts); the running app adds one on the home page itself.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

import { canonicalUrl, HOME_PAGE, indexablePages, PUBLIC_PAGES, SITE_FACTS, SITE_SUMMARY, type PageMeta } from "../src/data/seo";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function setMetaContent(html: string, attribute: "name" | "property", key: string, content: string): string {
  const tag = new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`);
  if (!tag.test(html)) throw new Error(`index.html has no <meta ${attribute}="${key}"> to rewrite`);
  return html.replace(tag, (_, before: string, after: string) => `${before}${escapeHtml(content)}${after}`);
}

/** index.html with one page's head in place of the home page's. */
export function pageHtml(indexHtml: string, page: PageMeta): string {
  if (!/<title>[^<]*<\/title>/.test(indexHtml)) throw new Error("index.html has no <title> to rewrite");
  let html = indexHtml.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(page.title)}</title>`);
  html = setMetaContent(html, "name", "description", page.description);
  html = setMetaContent(html, "property", "og:url", canonicalUrl(page));
  for (const key of ["og:title", "twitter:title"]) {
    html = setMetaContent(html, key.startsWith("og:") ? "property" : "name", key, page.title);
  }
  for (const key of ["og:description", "twitter:description"]) {
    html = setMetaContent(html, key.startsWith("og:") ? "property" : "name", key, page.description);
  }
  const extra = page.index
    ? `<link rel="canonical" href="${escapeHtml(canonicalUrl(page))}">`
    : `<meta name="robots" content="noindex">`;
  return html.replace("</head>", () => `  ${extra}\n  </head>`);
}

export function sitemapXml(pages: PageMeta[] = indexablePages()): string {
  const urls = pages.map((page) => `  <url><loc>${escapeHtml(canonicalUrl(page))}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export function llmsTxt(pages: PageMeta[] = indexablePages()): string {
  const links = pages.map((page) => `- [${page.title}](${canonicalUrl(page)}): ${page.description}`);
  return `# Nevermore\n\n> ${SITE_SUMMARY}\n\n${SITE_FACTS.map((fact) => `- ${fact}`).join("\n")}\n\n## Pages\n\n${links.join("\n")}\n`;
}

/** Every file the build adds, by its path inside the output directory. */
export function seoFiles(indexHtml: string): Record<string, string> {
  const files: Record<string, string> = { "sitemap.xml": sitemapXml(), "llms.txt": llmsTxt() };
  for (const page of PUBLIC_PAGES) {
    if (page.path === HOME_PAGE.path) continue;
    files[`${page.path.slice(1)}/index.html`] = pageHtml(indexHtml, page);
  }
  return files;
}

/** Writes them once the bundle (and so the final index.html) is on disk. */
export function seoPages(): Plugin {
  let outDir = "dist";
  return {
    name: "nevermore-seo-pages",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const indexHtml = readFileSync(path.join(outDir, "index.html"), "utf8");
      for (const [file, content] of Object.entries(seoFiles(indexHtml))) {
        const target = path.join(outDir, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
      }
    },
  };
}
