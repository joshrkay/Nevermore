// Where the site lives in production. Every public page, email and file names this address, never a preview or
// builder domain (QA F12: the Manuscript footer named edgar-allan-advisory.lovable.app, and the social preview image
// was served from an r2.dev preview bucket). index.html carries the same origin for its canonical link and social
// image (it can't import this); src/copy.guard.test.ts holds the two together.
export const SITE_DOMAIN = "nevermorepeo.com";
export const SITE_ORIGIN = `https://${SITE_DOMAIN}`;
