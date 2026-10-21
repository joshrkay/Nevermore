import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  oneLine,
  parseAdvisorNotification,
  parseProspectConfirmation,
  renderAdvisorNotification,
  renderProspectConfirmation,
} from "./messages";

const advisorPayload = {
  reference: "EAA-2026-AB12CD34",
  company_name: "Acme Co",
  contact_name: "Joanna Doe",
  contact_email: "jo@acme.example",
  contact_phone: "555-0100",
  resubmission: false,
};
const reviewUrl = "https://app.example.com/advisor/submissions/11111111-2222-3333-4444-555555555555";

// Intake values that must never appear in a standard alert or confirmation, even if a payload
// carried them. (The emails do say, in words, that such content is left out.)
const SENSITIVE = ["Zelda", "Zorander", "123456", "1980-02-03", "123-45-6789", "salary", "dependents"];
const leaky = {
  ...advisorPayload,
  employees: [{ first_name: "Zelda", last_name: "Zorander", dob: "1980-02-03", salary: 123456, dependents: [] }],
  salary: 123456,
  ssn: "123-45-6789",
};

describe("advisor notification", () => {
  const rendered = renderAdvisorNotification(parseAdvisorNotification(advisorPayload)!, { reviewUrl });

  it("carries the company, contact method, reference and a link to the secure review", () => {
    for (const body of [rendered.text, rendered.html]) {
      expect(body).toContain("Acme Co");
      expect(body).toContain("Joanna Doe");
      expect(body).toContain("jo@acme.example");
      expect(body).toContain("555-0100");
      expect(body).toContain("EAA-2026-AB12CD34");
      expect(body).toContain(reviewUrl);
    }
    expect(rendered.subject).toBe("New intake submitted: Acme Co (EAA-2026-AB12CD34)");
  });

  it("says the alert holds no census, payroll or document contents", () => {
    expect(rendered.text).toContain("Census, payroll and document contents are not included");
  });

  it("flags an update to an intake that was certified again", () => {
    const update = renderAdvisorNotification(parseAdvisorNotification({ ...advisorPayload, resubmission: true })!, { reviewUrl });
    expect(update.subject).toBe("Updated intake: Acme Co (EAA-2026-AB12CD34)");
    expect(update.text).toContain("updated and certified again");
  });

  it("leaves out contact details that were not given", () => {
    const sparse = parseAdvisorNotification({ reference: "EAA-1", company_name: null, contact_phone: "  " })!;
    const email = renderAdvisorNotification(sparse, { reviewUrl });
    expect(email.text).not.toMatch(/Contact:|Contact email:|Contact phone:/);
    expect(email.text).toContain("Company name not provided");
  });

  it("keeps only named fields, so nothing sensitive in the payload can be rendered", () => {
    const parsed = parseAdvisorNotification(leaky)!;
    expect(Object.keys(parsed).sort()).toEqual(
      ["companyName", "contactEmail", "contactName", "contactPhone", "reference", "resubmission"],
    );
    const email = renderAdvisorNotification(parsed, { reviewUrl });
    for (const word of SENSITIVE) {
      expect(`${email.subject}\n${email.text}\n${email.html}`.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it("needs a reference", () => {
    expect(parseAdvisorNotification({ ...advisorPayload, reference: "  " })).toBeNull();
    expect(parseAdvisorNotification(null)).toBeNull();
    expect(parseAdvisorNotification([])).toBeNull();
  });

  it("drops a contact email that is not an address", () => {
    expect(parseAdvisorNotification({ ...advisorPayload, contact_email: "not an email" })!.contactEmail).toBeNull();
  });
});

describe("prospect confirmation", () => {
  const payload = {
    reference: "EAA-2026-AB12CD34",
    company_name: "Acme Co",
    recipient_name: "Jo Doe",
    recipient_email: "jo@acme.example",
  };
  const ctx = { supportEmail: "support@mail.example.com", responseTime: "2 business days" };
  const rendered = renderProspectConfirmation(parseProspectConfirmation(payload)!, ctx);

  it("has the right company, reference, next step, timing and support contact", () => {
    for (const body of [rendered.text, rendered.html]) {
      expect(body).toContain("Acme Co");
      expect(body).toContain("EAA-2026-AB12CD34");
      expect(body).toContain("Jo Doe");
      expect(body).toContain("What happens next");
      expect(body).toContain("within 2 business days");
      expect(body).toContain("support@mail.example.com");
    }
    expect(rendered.subject).toBe("We received your intake (EAA-2026-AB12CD34)");
  });

  it("is branded", () => {
    expect(rendered.html).toContain("Edgar Allan Advisory");
    expect(rendered.text).toContain("Edgar Allan Advisory");
  });

  it("holds no census, payroll or document details, whatever the payload carries", () => {
    const email = renderProspectConfirmation(parseProspectConfirmation({ ...payload, employees: leaky.employees, salary: 123456 })!, ctx);
    for (const word of SENSITIVE) {
      expect(`${email.subject}\n${email.text}\n${email.html}`.toLowerCase()).not.toContain(word.toLowerCase());
    }
    expect(email.text).toContain("does not include your census, payroll or document details");
  });

  it("stays PEO-neutral and never promises to act on the prospect's behalf", () => {
    const all = `${rendered.subject}\n${rendered.text}\n${rendered.html}`;
    expect(all).not.toMatch(/trinet|justworks|rippling|insperity|totalsource/i);
    expect(all).not.toMatch(/on my behalf|on your behalf|obtain a quote|submit(ted)? to/i);
  });

  it("does not send to an address that is not an address", () => {
    expect(parseProspectConfirmation({ ...payload, recipient_email: "a@b.example, other@evil.example" })).toBeNull();
    expect(parseProspectConfirmation({ ...payload, recipient_email: "a b@c.example" })).toBeNull();
    expect(parseProspectConfirmation({ ...payload, recipient_email: null })).toBeNull();
    expect(parseProspectConfirmation({ ...payload, reference: "" })).toBeNull();
  });

  it("greets and names the company sensibly when those are missing", () => {
    const sparse = renderProspectConfirmation(parseProspectConfirmation({ ...payload, company_name: null, recipient_name: null })!, ctx);
    expect(sparse.text).toContain("Hello,");
    expect(sparse.text).toContain("certified for your company.");
  });
});

describe("prospect-entered text", () => {
  const hostile = `<script>alert("x")</script> & 'q' <img src=x onerror=alert(1)>`;

  it("is HTML-escaped in both emails", () => {
    const a = renderAdvisorNotification(parseAdvisorNotification({ ...advisorPayload, company_name: hostile, contact_name: hostile })!, { reviewUrl });
    const p = renderProspectConfirmation(
      parseProspectConfirmation({ reference: "EAA-1", company_name: hostile, recipient_name: hostile, recipient_email: "a@b.example" })!,
      { supportEmail: "s@b.example", responseTime: "a day" },
    );
    for (const html of [a.html, p.html]) {
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("&amp;");
    }
  });

  it("cannot break out of the review link", () => {
    const email = renderAdvisorNotification(parseAdvisorNotification(advisorPayload)!, { reviewUrl: 'https://x.example/"onmouseover="alert(1)' });
    expect(email.html).not.toContain('"onmouseover=');
    expect(email.html).toContain("&quot;onmouseover=");
  });

  it("cannot add header lines to the subject", () => {
    const email = renderAdvisorNotification(parseAdvisorNotification({ ...advisorPayload, company_name: "Acme\r\nBcc: evil@example.com" })!, { reviewUrl });
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it("is flattened to one capped line without invisible characters", () => {
    expect(oneLine("  a \n\n b\t\u202e c\u200b ", 50)).toBe("a b c");
    expect(oneLine("x".repeat(300), 10)).toBe("xxxxxxxxx…");
    expect(oneLine("  \n ", 10)).toBeNull();
    expect(oneLine(42, 10)).toBeNull();
  });

  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});
