import { SITE_DOMAIN } from "@/data/site";

/**
 * The firm a host names, or null for no firm (story CRM-P1.3a, D-17). A firm address is `<address>.<the site's domain>`;
 * for local development and the end-to-end tests `<address>.localhost` is read the same way. The bare domain, `www`
 * and any other host (an IP, a preview deployment) name no firm and keep today's behaviour.
 *
 * Anything in front of the domain that is more than one label (`a.b`) is returned whole: it matches no firm, so the
 * page says not found rather than quietly serving the bare domain's screens.
 *
 * This only picks what the screen shows. The database decides who may read what (D-18).
 */
export function firmAddressFromHost(hostname: string, siteDomain: string = SITE_DOMAIN): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const base of [siteDomain.toLowerCase(), "localhost"]) {
    const suffix = `.${base}`;
    if (!host.endsWith(suffix)) continue;
    const prefix = host.slice(0, -suffix.length);
    return prefix === "" || prefix === "www" ? null : prefix;
  }
  return null;
}

/** The host a firm is reached at: `<address>.<the site's domain>`. The address is read as the database reads one (lower case, no surrounding spaces). */
export function firmHostname(address: string, siteDomain: string = SITE_DOMAIN): string {
  return `${address.trim().toLowerCase()}.${siteDomain}`;
}

/** Where a firm is reached: `https://<address>.<the site's domain>`. */
export function firmUrl(address: string, siteDomain: string = SITE_DOMAIN): string {
  return `https://${firmHostname(address, siteDomain)}`;
}

/**
 * Where a firm is reached from the page the person is on: on `localhost` (local development and the end-to-end tests) the
 * firm's `<address>.localhost`, with this page's scheme and port; anywhere else the firm's address on the site's domain.
 */
export function firmUrlFrom(
  address: string,
  here: { protocol: string; hostname: string; port: string } = window.location,
  siteDomain: string = SITE_DOMAIN,
): string {
  const host = here.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    return `${here.protocol}//${address.trim().toLowerCase()}.localhost${here.port ? `:${here.port}` : ""}`;
  }
  return firmUrl(address, siteDomain);
}
