import { describe, expect, it } from "vitest";
import { firmAddressFromHost, firmHostname, firmUrl, firmUrlFrom } from "./firmHost";

// A firm address is <address>.<the site's domain> (story CRM-P1.3a, D-17). The app reads the firm from the host it
// is served on; the database, never this, decides who gets in (D-18).
describe("which firm a host names", () => {
  it("is the label in front of the site's domain", () => {
    expect(firmAddressFromHost("acme-brokers.nevermorepeo.com")).toBe("acme-brokers");
  });

  it("is no firm on the bare domain, on www, or on a host that is neither", () => {
    expect(firmAddressFromHost("nevermorepeo.com")).toBeNull();
    expect(firmAddressFromHost("www.nevermorepeo.com")).toBeNull();
    expect(firmAddressFromHost("localhost")).toBeNull();
    expect(firmAddressFromHost("127.0.0.1")).toBeNull();
    expect(firmAddressFromHost("my-app-git-branch.vercel.app")).toBeNull();
    expect(firmAddressFromHost("www.localhost")).toBeNull();
  });

  it("reads <address>.localhost for local development and the end-to-end tests", () => {
    expect(firmAddressFromHost("acme-brokers.localhost")).toBe("acme-brokers");
  });

  it("is blind to capitals and a trailing dot, as a host is", () => {
    expect(firmAddressFromHost("Acme-Brokers.NevermorePEO.com.")).toBe("acme-brokers");
  });

  it("is not fooled by a domain that merely ends the same way", () => {
    expect(firmAddressFromHost("acmenevermorepeo.com")).toBeNull();
    expect(firmAddressFromHost("acme.nevermorepeo.com.evil.example")).toBeNull();
    expect(firmAddressFromHost("evil.example")).toBeNull();
  });

  it("keeps a deeper name whole, so it matches no firm and shows as not found", () => {
    expect(firmAddressFromHost("a.b.nevermorepeo.com")).toBe("a.b");
    expect(firmAddressFromHost("www.acme.nevermorepeo.com")).toBe("www.acme");
  });

  it("takes the site's domain as an argument, so another domain can be tested", () => {
    expect(firmAddressFromHost("acme.example.org", "example.org")).toBe("acme");
    expect(firmAddressFromHost("acme.nevermorepeo.com", "example.org")).toBeNull();
  });
});

describe("the web address of a firm", () => {
  it("is the address in front of the site's domain, read the way a host is", () => {
    expect(firmHostname("  Acme-Brokers ")).toBe("acme-brokers.nevermorepeo.com");
    expect(firmUrl("acme-brokers")).toBe("https://acme-brokers.nevermorepeo.com");
    expect(firmUrl("  Acme-Brokers ")).toBe("https://acme-brokers.nevermorepeo.com");
    expect(firmUrl("acme", "example.org")).toBe("https://acme.example.org");
  });
});

describe("a firm's web address, reached from the page the person is on (the \"Choose a firm\" links)", () => {
  it("is the firm's address on the site's domain from the bare domain, www or a preview", () => {
    for (const hostname of ["nevermorepeo.com", "www.nevermorepeo.com", "preview-123.vercel.app"]) {
      expect(firmUrlFrom("acme-brokers", { protocol: "https:", hostname, port: "" })).toBe("https://acme-brokers.nevermorepeo.com");
    }
  });

  it("stays on this machine, with this page's scheme and port, from localhost", () => {
    expect(firmUrlFrom("Acme-Brokers", { protocol: "http:", hostname: "localhost", port: "4180" })).toBe("http://acme-brokers.localhost:4180");
    expect(firmUrlFrom("acme", { protocol: "http:", hostname: "other.localhost", port: "" })).toBe("http://acme.localhost");
  });
});
