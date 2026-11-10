import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { canonicalUrl, pageMetaFor, type PageMeta as Meta } from "@/data/seo";

function setTag(doc: Document, selector: string, create: () => HTMLElement, attribute: string, value: string | null) {
  const existing = doc.head.querySelector<HTMLElement>(selector);
  if (value === null) {
    existing?.remove();
    return;
  }
  const tag = existing ?? doc.head.appendChild(create());
  tag.setAttribute(attribute, value);
}

const metaTag = (doc: Document, attribute: "name" | "property", key: string) => () => {
  const tag = doc.createElement("meta");
  tag.setAttribute(attribute, key);
  return tag;
};

/** Puts one page's title, description, robots rule and canonical address in the document's head. */
export function applyPageMeta(page: Meta, doc: Document = document) {
  doc.title = page.title;
  setTag(doc, 'meta[name="description"]', metaTag(doc, "name", "description"), "content", page.description);
  setTag(doc, 'meta[property="og:url"]', metaTag(doc, "property", "og:url"), "content", canonicalUrl(page));
  // Only an indexable page has a canonical address; a private one says "noindex" instead.
  setTag(doc, 'meta[name="robots"]', metaTag(doc, "name", "robots"), "content", page.index ? null : "noindex");
  setTag(
    doc,
    'link[rel="canonical"]',
    () => {
      const link = doc.createElement("link");
      link.setAttribute("rel", "canonical");
      return link;
    },
    "href",
    page.index ? canonicalUrl(page) : null,
  );
}

/**
 * Keeps the head in step with the route (src/data/seo.ts). index.html is the same file for every address, so
 * without this a signed-in page, or an address that doesn't exist, would read to a search engine as the home page.
 */
const PageMeta = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    applyPageMeta(pageMetaFor(pathname));
  }, [pathname]);
  return null;
};

export default PageMeta;
