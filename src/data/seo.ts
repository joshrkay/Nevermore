// What a search engine or a link preview is told about each page: its title, its description and whether it may be
// indexed. The app serves one index.html for every route, so without this every address carried the home page's
// title and description, and the signed-in pages were as indexable as the landing page.
//
// Three things read this table, so they can't drift apart:
//   - the running app (src/components/PageMeta.tsx) keeps the document's head in step with the route;
//   - the build (scripts/seoBuild.ts) writes a copy of index.html for each public page with that page's head already
//     in it, for crawlers that don't run scripts, plus sitemap.xml and llms.txt;
//   - vercel.json sends "X-Robots-Tag: noindex" for the private routes (src/seo.guard.test.ts holds it to this table).
//
// Relative imports only: vite.config.ts loads this file, and the "@/" alias doesn't exist there.
import { LEGAL_COPY_APPROVED } from "./legal";
import { SITE_ORIGIN } from "./site";

export interface PageMeta {
  /** The route, as the router matches it ("/privacy"). */
  path: string;
  title: string;
  description: string;
  /** Whether search engines may index the page. Only the public pages may. */
  index: boolean;
}

const BRAND = "Nevermore";
const titled = (name: string) => `${name} | ${BRAND}`;

/** The landing page. index.html carries the same title and description (src/seo.guard.test.ts). */
export const HOME_PAGE: PageMeta = {
  path: "/",
  title: "Nevermore: PEO packets without the back-and-forth",
  description:
    "Chat with Lenore, drop in your census, and leave with a complete underwriting packet to send to the PEO you choose. About 15–20 minutes, and you can start as a guest.",
  index: true,
};

/**
 * The pages anyone can read without signing in. The legal pages stay out of the index while they are drafts
 * (src/data/legal.ts): a search result shouldn't quote terms counsel hasn't approved.
 */
export const PUBLIC_PAGES: PageMeta[] = [
  HOME_PAGE,
  {
    path: "/manuscript/demo",
    title: titled("Sample PEO underwriting packet"),
    description:
      "See the packet a PEO's underwriters receive: company profile, workforce and state breakdown, employee census, current benefits and underwriting readiness, in the same layout every time. Sample data only.",
    index: true,
  },
  {
    path: "/privacy",
    title: titled("Privacy Policy"),
    description: "What Nevermore collects during a PEO underwriting intake, who handles it and how long it's kept.",
    index: LEGAL_COPY_APPROVED,
  },
  {
    path: "/terms",
    title: titled("Terms of Use"),
    description: "The terms for using Nevermore, a service of Edgar Allan Advisory, to prepare a PEO underwriting packet.",
    index: LEGAL_COPY_APPROVED,
  },
];

// Everything else needs an account or belongs to one visitor, and is never indexed. Only the tab's title differs.
const PRIVATE_ROUTES: [RegExp, string][] = [
  [/^\/login$/, "Sign in"],
  [/^\/auth\/.+$/, "Signing you in"],
  [/^\/broker\/sign-in$/, "Advisor and broker sign in"],
  [/^\/broker\/callback$/, "Signing you in"],
  [/^\/firms\/new$/, "Sign up your firm"],
  [/^\/join\/[^/]+$/, "Join a firm"],
  [/^\/firm\/invitations$/, "Invitations"],
  [/^\/start$/, "Your intake"],
  [/^\/profile$/, "Your profile"],
  [/^\/manuscript(\/[^/]+)?$/, "Your packet"],
  [/^\/advisor(\/.*)?$/, "Advisor Console"],
];

/** A private route of each kind, for the tests that hold vercel.json and the router to this table. */
export const PRIVATE_PATH_EXAMPLES = [
  "/login",
  "/auth/callback",
  "/broker/sign-in",
  "/broker/callback",
  "/firms/new",
  "/join/an-invitation-token",
  "/firm/invitations",
  "/start",
  "/profile",
  "/manuscript",
  "/manuscript/EAA-2026-0001",
  "/advisor",
  "/advisor/outbox",
  "/advisor/submissions/123",
];

/**
 * The meta for an address. One the app doesn't route (a mistyped link) is a "not found" page and is not indexed:
 * the server answers 200 for every address, so this is what keeps junk addresses out of search results.
 */
export function pageMetaFor(pathname: string): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : "/";
  const page = PUBLIC_PAGES.find((p) => p.path === path);
  if (page) return page;
  const name = PRIVATE_ROUTES.find(([pattern]) => pattern.test(path))?.[1] ?? "Page not found";
  return { path, title: titled(name), description: HOME_PAGE.description, index: false };
}

/** The address search engines should treat as the page's own. */
export const canonicalUrl = (page: PageMeta) => `${SITE_ORIGIN}${page.path}`;

/** The pages listed in sitemap.xml and llms.txt. */
export const indexablePages = () => PUBLIC_PAGES.filter((p) => p.index);

// llms.txt: a plain-text summary for AI assistants and crawlers that don't run scripts, which otherwise see an empty
// page. It is public copy, so it says only what the landing page and the Privacy Policy already say
// (src/copy.guard.test.ts reads this file).
export const SITE_SUMMARY =
  "Nevermore prepares PEO underwriting packets. A prospect chats with Lenore, an AI intake assistant, uploads a census and other documents, reviews and certifies every answer, and downloads a complete packet to send to the PEO they choose. It takes about 15–20 minutes and can be started as a guest.";

export const SITE_FACTS = [
  "Nevermore is a service of Edgar Allan Advisory, which is not a PEO, an insurance carrier or an insurance agency.",
  "Nevermore is PEO-neutral: the prospect picks the PEO and sends the packet themselves.",
  "Every packet follows the same layout: company profile, workforce and state breakdown, employee census, dependent tiers, current benefits and underwriting readiness, then the signed certification.",
  "The prospect verifies their email, reviews the data and signs a certification before the packet is generated. Every packet carries a File ID.",
];
