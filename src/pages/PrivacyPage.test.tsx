import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PrivacyPage from "./PrivacyPage";
import { DATA_CLASSES, RETENTION_RULES, SENSITIVITY } from "@/data/dataPolicy";
import { LEGAL_COPY_APPROVED, PRIVACY_CONTACT, PRIVACY_CONTACT_PENDING, PRIVACY_POLICY_VERSION, SERVICE_PROVIDERS } from "@/data/legal";

const renderPage = () =>
  render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );

describe("Privacy Policy", () => {
  it("has its title, version and every section", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Version ${PRIVACY_POLICY_VERSION}`))).toBeInTheDocument();
    for (const name of [
      "Who we are",
      "What we collect",
      "How we use it",
      "Who sees it",
      "How long we keep it",
      "Deleting your information",
      "How we protect it",
      "Your employees' information",
      "Changes to this policy",
      "Contact",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("says it is a draft until counsel approves it", () => {
    renderPage();
    expect(LEGAL_COPY_APPROVED).toBe(false);
    expect(screen.getByRole("note")).toHaveTextContent("Draft, pending legal review.");
  });

  it("discloses our role and that a listed PEO is not an endorsement", () => {
    renderPage();
    const who = screen.getByRole("region", { name: "Who we are" });
    expect(who).toHaveTextContent("We are not a PEO, an insurance carrier or an insurance agency.");
    expect(who).toHaveTextContent("We don't submit your packet or request a quote for you");
    expect(who).toHaveTextContent("naming it doesn't mean it endorses, sponsors or works with us");
  });

  it("lists every data class under its sensitivity level", () => {
    renderPage();
    const collect = screen.getByRole("region", { name: "What we collect" });
    for (const c of DATA_CLASSES) {
      const level = within(collect).getByRole("heading", { level: 3, name: SENSITIVITY[c.sensitivity].label });
      expect(level.parentElement).toHaveTextContent(c.label);
      expect(level.parentElement).toHaveTextContent(c.examples);
    }
  });

  it("shows every retention rule from the data policy, one row each", () => {
    renderPage();
    const table = within(screen.getByRole("region", { name: "How long we keep it" })).getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(RETENTION_RULES.length);
    RETENTION_RULES.forEach((rule, i) => {
      expect(within(rows[i]).getByRole("rowheader")).toHaveTextContent(rule.record);
      expect(rows[i]).toHaveTextContent(rule.period);
      expect(rows[i]).toHaveTextContent(rule.then);
    });
  });

  it("names every service that handles intake information", () => {
    renderPage();
    const table = within(screen.getByRole("region", { name: "Who sees it" })).getByRole("table");
    for (const p of SERVICE_PROVIDERS) {
      expect(within(table).getByRole("rowheader", { name: p.name })).toBeInTheDocument();
    }
    // Every upload is sent to the malware scanner (document-upload, document-scan), so it is listed even
    // before D13 names it.
    expect(within(table).getByRole("rowheader", { name: /malware/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "How we use it" })).toHaveTextContent("We don't sell your information");
  });

  it("says where to send requests, or that the address is still to come", () => {
    renderPage();
    const contact = screen.getByRole("region", { name: "Contact" });
    if (PRIVACY_CONTACT) expect(contact).toHaveTextContent(PRIVACY_CONTACT);
    else expect(contact).toHaveTextContent(PRIVACY_CONTACT_PENDING);
  });

  it("links to the Terms of Use, and carries the legal links in its footer", () => {
    renderPage();
    expect(within(screen.getByRole("region", { name: "Contact" })).getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
    const legal = screen.getByRole("navigation", { name: "Legal" });
    expect(within(legal).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(within(legal).getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
  });
});
