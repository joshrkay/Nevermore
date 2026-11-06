import { describe, expect, it } from "vitest";
import { FUNNEL_STEPS } from "./funnel";
import {
  campaignTags,
  countsByPartner,
  describeSource,
  partnerKindLabel,
  partnerLink,
  REFERRAL_PARTNER_KIND_LABELS,
  REFERRAL_PARTNER_KINDS,
  sourceRows,
  sourceTitle,
  suggestPartnerCode,
} from "./referralPartners";
import { SOURCE_CODE_PATTERN } from "./intakeSource";

const none = { referral_code: null, utm_source: null, utm_medium: null, utm_campaign: null };

describe("partners", () => {
  it("labels every kind", () => {
    for (const kind of REFERRAL_PARTNER_KINDS) expect(REFERRAL_PARTNER_KIND_LABELS[kind]).toBeTruthy();
    expect(partnerKindLabel("accounting")).toBe("Accountant, CPA or fractional CFO");
    expect(partnerKindLabel("unknown")).toBe("unknown");
  });

  it("offers a code from the partner's name, in the form the database keeps", () => {
    expect(suggestPartnerCode("Acme CFO Partners")).toBe("acme-cfo-partners");
    expect(suggestPartnerCode("Smith & Jones, LLP")).toBe("smith-jones-llp");
    expect(SOURCE_CODE_PATTERN.test(suggestPartnerCode("A".repeat(200)))).toBe(true);
    expect(suggestPartnerCode("@@")).toBe("");
  });

  it("gives each partner a link to the front page with their code", () => {
    expect(partnerLink("acme-cfo")).toBe("https://nevermorepeo.com/?ref=acme-cfo");
  });
});

describe("describing a source", () => {
  it("names the partner, or says the code names none, then the campaign tags", () => {
    expect(describeSource({ ...none, referral_code: "acme-cfo", utm_source: "partner" }, "Acme CFO Partners")).toBe(
      "Referred by Acme CFO Partners · Campaign: partner",
    );
    expect(describeSource({ ...none, referral_code: "typo-code" }, null)).toBe("Referral code typo-code (no partner has this code)");
    expect(describeSource({ ...none, utm_source: "newsletter", utm_medium: "email", utm_campaign: "renewals-2027" }, null)).toBe(
      "Campaign: newsletter / email / renewals-2027",
    );
    expect(describeSource(none, null)).toBe("No tagged link");
    expect(campaignTags(none)).toBeNull();
  });
});

describe("sourceTitle", () => {
  it("names a source by its partner, its unlisted code, its campaign tags or none", () => {
    expect(sourceTitle({ source: { ...none, referral_code: "acme-cfo", utm_campaign: "spring" }, partnerName: "Acme" })).toEqual({
      title: "Acme",
      detail: "ref=acme-cfo · spring",
    });
    expect(sourceTitle({ source: { ...none, referral_code: "typo" }, partnerName: null })).toEqual({ title: "Unlisted code typo", detail: "ref=typo" });
    expect(sourceTitle({ source: { ...none, utm_source: "linkedin", utm_medium: "social" }, partnerName: null })).toEqual({
      title: "linkedin / social",
      detail: null,
    });
    expect(sourceTitle({ source: none, partnerName: null })).toEqual({ title: "No tagged link", detail: null });
  });
});

describe("sourceRows", () => {
  it("reads the database's rows, every step a count, a bad number as zero", () => {
    const rows = sourceRows([
      { referral_code: "acme-cfo", partner_name: "Acme", utm_source: null, utm_medium: "", utm_campaign: null, started: "4", answered: 3, certified: 2, census_provided: -1 },
      { referral_code: null, partner_name: null, utm_source: "linkedin", utm_medium: null, utm_campaign: null, started: 2, certified: "soon" },
    ]);
    expect(rows[0].source).toEqual({ ...none, referral_code: "acme-cfo" });
    expect(rows[0].partnerName).toBe("Acme");
    expect(Object.keys(rows[0].counts)).toEqual([...FUNNEL_STEPS]);
    expect(rows[0].counts).toMatchObject({ started: 4, answered: 3, certified: 2, census_provided: 0, manuscript_downloaded: 0 });
    expect(rows[1].counts.certified).toBe(0);
  });

  it("sums each partner's intakes over every campaign their link carried", () => {
    const rows = sourceRows([
      { referral_code: "acme-cfo", utm_campaign: "spring", started: 3, certified: 1 },
      { referral_code: "acme-cfo", utm_campaign: null, started: 2, certified: 2 },
      { referral_code: "other", started: 1, certified: 0 },
      { referral_code: null, utm_source: "linkedin", started: 9, certified: 4 },
    ]);
    const totals = countsByPartner(rows);
    expect(totals.get("acme-cfo")).toEqual({ started: 5, certified: 3 });
    expect(totals.get("other")).toEqual({ started: 1, certified: 0 });
    expect(totals.size).toBe(2);
  });
});
