import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TermsPage from "./TermsPage";
import { COUNSEL_PLACEHOLDER, TERMS_VERSION } from "@/data/legal";

const renderPage = () =>
  render(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>,
  );

describe("Terms of Use", () => {
  it("has its title, version and every section", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Version ${TERMS_VERSION}`))).toBeInTheDocument();
    for (const name of [
      "Who we are and what we do",
      "What we don't do",
      "Who may use it",
      "Your information and its accuracy",
      "Acceptable use",
      "Your packet",
      "Availability",
      "Disclaimers",
      "Limitation of liability",
      "Governing law",
      "Disputes and arbitration",
      "Changes to these terms",
      "Contact",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("says it is a draft until counsel approves it", () => {
    renderPage();
    expect(screen.getByRole("note")).toHaveTextContent("Draft, pending legal review.");
  });

  it("discloses our role and what we don't do", () => {
    renderPage();
    expect(screen.getByRole("region", { name: "Who we are and what we do" })).toHaveTextContent(
      "We are not a PEO, an insurance carrier or an insurance agency.",
    );
    const not = screen.getByRole("region", { name: "What we don't do" });
    expect(not).toHaveTextContent("We don't submit your packet to a PEO or request a quote for you.");
    expect(not).toHaveTextContent("a promise that a PEO will accept your company or price it");
  });

  it("says AI-captured answers can be wrong and the prospect certifies them", () => {
    renderPage();
    const accuracy = screen.getByRole("region", { name: "Your information and its accuracy" });
    expect(accuracy).toHaveTextContent("She can misread or misunderstand");
    expect(accuracy).toHaveTextContent("When you certify, you confirm that the information is accurate");
  });

  it("leaves the sections only counsel can write visibly unfinished", () => {
    renderPage();
    for (const name of ["Disclaimers", "Limitation of liability", "Governing law", "Disputes and arbitration"]) {
      expect(screen.getByRole("region", { name })).toHaveTextContent(COUNSEL_PLACEHOLDER);
    }
  });

  it("links to the Privacy Policy, and carries the legal links in its footer", () => {
    renderPage();
    expect(within(screen.getByRole("region", { name: "Your packet" })).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    const legal = screen.getByRole("navigation", { name: "Legal" });
    expect(within(legal).getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
  });
});
