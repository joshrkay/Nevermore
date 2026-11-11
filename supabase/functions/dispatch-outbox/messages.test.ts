import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  lines,
  oneLine,
  parseAdvisorNotification,
  parseDraftExpiryReminder,
  parseInformationRequest,
  parsePeoMailArrived,
  parseProspectConfirmation,
  renderAdvisorNotification,
  renderDraftExpiryReminder,
  renderInformationRequest,
  renderPeoMailArrived,
  renderProspectConfirmation,
} from "./messages";
import { fieldLabels } from "./fieldLabels";

const advisorPayload = {
  reference: "EAA-2026-AB12CD34",
  company_name: "Acme Co",
  contact_name: "Pat Contact",
  contact_email: "jo@acme.example",
  contact_phone: "555-0100",
  signer_name: "Joanna Doe",
  signer_title: "Chief Executive Officer",
  employee_count: 28,
  hq_state: "CA",
  certified_at: "2026-05-01T12:34:56Z",
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

  it("has the spec's subject, and flags a re-certified intake as updated", () => {
    expect(rendered.subject).toBe("New Intake Certified: Acme Co (EAA-2026-AB12CD34)");
    const update = renderAdvisorNotification(parseAdvisorNotification({ ...advisorPayload, resubmission: true })!, { reviewUrl });
    expect(update.subject).toBe("Updated Intake: Acme Co (EAA-2026-AB12CD34)");
    expect(update.text).toContain("updated and certified again");
    expect(update.html).toContain("<title>Updated Intake: Acme Co (EAA-2026-AB12CD34)</title>");
  });

  it("lists the company, signer, title, work email, phone, headcount, HQ state, File ID and certification time", () => {
    expect(rendered.text).toContain("Company Legal Name: Acme Co");
    expect(rendered.text).toContain("Primary Signer: Joanna Doe");
    expect(rendered.text).toContain("Title: Chief Executive Officer");
    expect(rendered.text).toContain("Work Email: jo@acme.example");
    expect(rendered.text).toContain("Phone: 555-0100");
    expect(rendered.text).toContain("Employee Count: 28");
    expect(rendered.text).toContain("HQ State: CA");
    expect(rendered.text).toContain("File ID: EAA-2026-AB12CD34");
    expect(rendered.html).toMatch(/<th scope="row"[^>]*>File ID<\/th><td[^>]*>EAA-2026-AB12CD34<\/td>/);
    expect(`${rendered.text}\n${rendered.html}`).not.toMatch(/reference/i);
    expect(rendered.text).toContain("Certified: 2026-05-01 12:34 UTC");
    for (const value of ["Acme Co", "Joanna Doe", "Chief Executive Officer", "jo@acme.example", "555-0100", ">28<", ">CA<", "EAA-2026-AB12CD34", "2026-05-01 12:34 UTC"]) {
      expect(rendered.html).toContain(value);
    }
  });

  it("links straight to the authenticated review, in both bodies", () => {
    expect(rendered.text).toContain(`\n${reviewUrl}\n`);
    expect(rendered.html).toContain(`href="${reviewUrl}"`);
    expect(rendered.text).toContain("advisor sign-in required");
  });

  it("says the alert holds no census, payroll or document contents", () => {
    expect(rendered.text).toContain("Census, payroll and document contents are not included");
  });

  it("shows every listed detail, 'Not provided' when empty, so a blank is not mistaken for an omission", () => {
    const sparse = parseAdvisorNotification({ reference: "EAA-1", company_name: null, contact_phone: "  " })!;
    const email = renderAdvisorNotification(sparse, { reviewUrl });
    expect(email.subject).toBe("New Intake Certified: Company name not provided (EAA-1)");
    for (const label of ["Company Legal Name", "Primary Signer", "Title", "Work Email", "Phone", "Employee Count", "HQ State", "Certified"]) {
      expect(email.text).toContain(`${label}: Not provided`);
    }
    expect(email.text).toContain("File ID: EAA-1");
  });

  it("falls back to the contact name for the signer on an alert queued before signers were recorded", () => {
    const legacy = parseAdvisorNotification({ reference: "EAA-1", company_name: "Old Co", contact_name: "Pat Contact" })!;
    expect(renderAdvisorNotification(legacy, { reviewUrl }).text).toContain("Primary Signer: Pat Contact");
  });

  it("is a clean document: a title, a viewport for phones, a language, and row headers for the details", () => {
    expect(rendered.html).toMatch(/^<!doctype html>\n<html lang="en">\n<head>/);
    expect(rendered.html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(rendered.html).toContain('<meta charset="utf-8">');
    expect(rendered.html).toMatch(/<th scope="row"[^>]*>Primary Signer<\/th><td[^>]*>Joanna Doe<\/td>/);
    expect(rendered.html).not.toContain("role=\"presentation\"");
    // A phone-width column, and the link is text, not an image.
    expect(rendered.html).toContain("max-width:560px");
    expect(rendered.html).toContain(">Open the secure review</a>");
  });

  it("keeps only named fields, so nothing sensitive in the payload can be rendered", () => {
    const parsed = parseAdvisorNotification(leaky)!;
    expect(Object.keys(parsed).sort()).toEqual(
      ["certifiedAt", "companyName", "contactEmail", "contactName", "contactPhone", "employeeCount", "hqState", "reference",
       "resubmission", "signerName", "signerTitle"],
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

  it("drops a work email that is not an address", () => {
    expect(parseAdvisorNotification({ ...advisorPayload, contact_email: "not an email" })!.contactEmail).toBeNull();
  });

  it("keeps a headcount, state and time only when they are what the database writes", () => {
    const parse = (over: Record<string, unknown>) => parseAdvisorNotification({ ...advisorPayload, ...over })!;
    expect(parse({ employee_count: 0 }).employeeCount).toBe(0);
    for (const bad of [-1, 1.5, "28", NaN, 10_000_001, null]) expect(parse({ employee_count: bad }).employeeCount).toBeNull();
    expect(parse({ hq_state: "tx" }).hqState).toBe("TX");
    for (const bad of ["California", "C", "1A", 5, null]) expect(parse({ hq_state: bad }).hqState).toBeNull();
    for (const bad of ["yesterday", "2026-05-01", "2026-05-01T12:34:56+02:00", "2026-13-45T99:99:99Z", 7, null]) {
      expect(parse({ certified_at: bad }).certifiedAt).toBeNull();
    }
  });

  it("flattens and escapes prospect-entered text in the new fields", () => {
    const email = renderAdvisorNotification(
      parseAdvisorNotification({ ...advisorPayload, signer_title: "CEO\r\nBcc: x@evil.example <b>", signer_name: "<script>alert(1)</script>" })!,
      { reviewUrl },
    );
    expect(email.text).toContain("Title: CEO Bcc: x@evil.example <b>");
    expect(email.text.split("\n").filter((l) => l.startsWith("Bcc"))).toEqual([]);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<b>");
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
    expect(rendered.subject).toBe("Your Nevermore intake is in (EAA-2026-AB12CD34)");
  });

  it("calls the identifier the File ID, as the prospect's signed Manuscript does", () => {
    expect(rendered.text).toContain("File ID: EAA-2026-AB12CD34");
    expect(rendered.text).toContain("quote your File ID");
    expect(rendered.html).toMatch(/<th scope="row"[^>]*>File ID<\/th><td[^>]*>EAA-2026-AB12CD34<\/td>/);
    expect(rendered.html).toContain("File ID EAA-2026-AB12CD34.");
    expect(`${rendered.text}\n${rendered.html}`).not.toMatch(/reference/i);
  });

  it("is branded Nevermore, in the brand's colours, and signs off as the team", () => {
    expect(rendered.html).toMatch(/<div style="[^"]*color:#B4372A;">Nevermore<\/div>/);
    expect(rendered.html).toContain("background:#FFFBF6;");
    expect(rendered.text.endsWith("\nThe Nevermore team")).toBe(true);
    // The operator's name belongs to the legal pages; the emails speak as the brand.
    expect(`${rendered.subject}\n${rendered.text}\n${rendered.html}`).not.toMatch(/Edgar Allan/);
  });

  it("holds no census, payroll or document details, whatever the payload carries", () => {
    const email = renderProspectConfirmation(parseProspectConfirmation({ ...payload, employees: leaky.employees, salary: 123456 })!, ctx);
    for (const word of SENSITIVE) {
      expect(`${email.subject}\n${email.text}\n${email.html}`.toLowerCase()).not.toContain(word.toLowerCase());
    }
    expect(email.text).toContain("doesn't include your census, payroll or document details");
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
    expect(sparse.text.startsWith("Hi there,\n")).toBe(true);
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

  // The line goes into the frozen message, which is stored as jsonb. Postgres refuses jsonb text
  // holding a lone surrogate, so a prospect who could plant one would make their event unfreezable.
  describe("cap and well-formedness", () => {
    const codePoints = (s: string) => Array.from(s).length;
    // The UTF-8 round trip is what the database sees: a lone surrogate would not survive it.
    const utf8 = (s: string) => new TextDecoder().decode(new TextEncoder().encode(s));
    // JSON.stringify writes a lone surrogate as an escape, and that escape is what jsonb rejects.
    const hasSurrogateEscape = (s: string) => /\\ud[89a-f][0-9a-f]{2}/i.test(JSON.stringify(s));

    it("counts the cap in code points, so an emoji at the boundary is kept whole or dropped whole", () => {
      // UTF-16 index 8 and 9 are the two halves of the emoji, so a cut at 9 code units splits it.
      const out = oneLine(`${"a".repeat(8)}\u{1F600}tail`, 10)!;
      expect(out).toBe(`${"a".repeat(8)}\u{1F600}\u2026`);
      expect(codePoints(out)).toBe(10);
      expect(hasSurrogateEscape(out)).toBe(false);
      expect(utf8(out)).toBe(out);
    });

    it("drops an emoji that does not fit rather than cutting it in half", () => {
      const out = oneLine(`${"a".repeat(9)}\u{1F600}tail`, 10)!;
      expect(out).toBe(`${"a".repeat(9)}\u2026`);
      expect(hasSurrogateEscape(out)).toBe(false);
    });

    it("leaves text of exactly the cap untouched, counting an emoji once", () => {
      const exact = `${"a".repeat(9)}\u{1F600}`;
      expect(oneLine(exact, 10)).toBe(exact);
      expect(oneLine(`${exact}b`, 10)).toBe(`${"a".repeat(9)}\u2026`);
    });

    it("removes a lone surrogate wherever it sits, keeping valid pairs", () => {
      expect(oneLine("ab\ud800cd", 50)).toBe("ab cd");
      expect(oneLine("abc\ud83d", 50)).toBe("abc");
      expect(oneLine("\udc00abc", 50)).toBe("abc");
      expect(oneLine("\u{1F600}\ud83d", 50)).toBe("\u{1F600}");
      expect(oneLine("x\ude00\u{1F600}\ud800\ud800y", 50)).toBe("x \u{1F600} y");
      expect(oneLine("\ud800".repeat(100), 50)).toBeNull();
    });

    it("always yields text that survives JSON and UTF-8 unchanged", () => {
      const hostile = ["a\ud83d", "\ude00b", "\ud83d\ud83d\ude00\ude00", `${"z".repeat(8)}\ud83d\u{1F600}`, "x\u0000y", "\u{1F600}".repeat(30)];
      for (const input of hostile) {
        const out = oneLine(input, 12);
        if (out === null) continue;
        expect(JSON.parse(JSON.stringify(out))).toBe(out);
        expect(hasSurrogateEscape(out)).toBe(false);
        expect(utf8(out)).toBe(out);
        expect(codePoints(out)).toBeLessThanOrEqual(12);
      }
    });

    it("keeps a prospect's stray surrogate out of the rendered email", () => {
      const stray = "Jo\ud83d Doe\ude00";
      const email = renderProspectConfirmation(
        parseProspectConfirmation({ reference: "EAA-1", company_name: `Acme${stray}`, recipient_name: stray, recipient_email: "a@b.example" })!,
        { supportEmail: "s@b.example", responseTime: "a day" },
      );
      expect(hasSurrogateEscape(JSON.stringify(email))).toBe(false);
      expect(JSON.parse(JSON.stringify(email))).toEqual(email);
    });
  });

  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});

describe("information request", () => {
  const payload = {
    reference: "EAA-2026-0042",
    company_name: "Acme Co",
    recipient_name: "Jo Doe",
    recipient_email: "jo@acme.example",
    message: "Please confirm your pay frequency.\n\n\nAnd upload the census <b>today</b>.",
    fields: ["pay_frequency", "census", "pay_frequency", "Bad Key", 7],
    requested_at: "2026-11-05T12:00:00Z",
  };
  const ctx = { supportEmail: "support@example.com", intakeUrl: "https://app.example.com/start?session=s1", fieldLabels: ["Pay frequency", "Employee census"] };

  it("keeps the named facts, the message's lines (one blank between paragraphs) and well-formed field keys, each once", () => {
    expect(parseInformationRequest(payload)).toEqual({
      reference: "EAA-2026-0042",
      companyName: "Acme Co",
      recipientName: "Jo Doe",
      recipientEmail: "jo@acme.example",
      message: ["Please confirm your pay frequency.", "", "And upload the census <b>today</b>."],
      fields: ["pay_frequency", "census"],
    });
  });

  it("can't be sent without a File ID, a recipient or a message", () => {
    expect(parseInformationRequest({ ...payload, reference: "" })).toBeNull();
    expect(parseInformationRequest({ ...payload, recipient_email: "nobody" })).toBeNull();
    expect(parseInformationRequest({ ...payload, message: " \n " })).toBeNull();
    expect(parseInformationRequest(null)).toBeNull();
  });

  it("caps the message as a whole", () => {
    const long = lines(`${"a".repeat(600)}\n${"b".repeat(600)}`, 1000);
    expect(long.join("").length).toBeLessThanOrEqual(1000);
    expect(long[1].endsWith("…")).toBe(true);
  });

  it("says who asks, what, about which answers, and where to answer, escaped", () => {
    const r = renderInformationRequest(parseInformationRequest(payload)!, ctx);
    expect(r.subject).toBe("Your advisor needs a bit more info (EAA-2026-0042)");
    expect(r.text).toContain("Hi Jo Doe,");
    expect(r.text).toContain("certify again on the Certify & sign tab");
    expect(r.text).toContain("Their request\nPlease confirm your pay frequency.\n\nAnd upload the census <b>today</b>.");
    expect(r.text).toContain("What it's about\n- Pay frequency\n- Employee census");
    expect(r.text).toContain("File ID: EAA-2026-0042");
    expect(r.text).toContain("https://app.example.com/start?session=s1");
    expect(r.html).toContain("And upload the census &lt;b&gt;today&lt;/b&gt;.");
    expect(r.html).not.toContain("<b>today</b>");
    expect(r.html).toContain('href="https://app.example.com/start?session=s1"');
  });

  it("leaves out the field list when the request names no field", () => {
    const r = renderInformationRequest(parseInformationRequest({ ...payload, fields: [] })!, { ...ctx, fieldLabels: [] });
    expect(r.text).not.toContain("What it's about");
    expect(r.html).not.toContain("<ul");
  });

  it("never carries intake contents a payload might hold", () => {
    const r = renderInformationRequest(parseInformationRequest({ ...leaky, ...payload })!, ctx);
    for (const value of SENSITIVE) {
      expect(r.text).not.toContain(value);
      expect(r.html).not.toContain(value);
    }
  });

  it("names fields as the intake schema labels them, the census's older name as the census, unknown keys left out", () => {
    expect(fieldLabels(["pay_frequency", "employees", "census", "made_up"])).toEqual(["Pay frequency", "Employee census"]);
  });
});

describe("draft expiry reminder", () => {
  const payload = { company_name: "Acme Co", recipient_name: "Jo Doe", recipient_email: "jo@acme.example", expires_at: "2026-12-05T09:30:00Z" };
  const ctx = { supportEmail: "support@example.com", intakeUrl: "https://app.example.com/start?session=s1", profileUrl: "https://app.example.com/profile" };

  it("needs a recipient and a UTC closing time", () => {
    expect(parseDraftExpiryReminder(payload)).toEqual({
      companyName: "Acme Co", recipientName: "Jo Doe", recipientEmail: "jo@acme.example", expiresAt: "2026-12-05T09:30:00Z",
    });
    expect(parseDraftExpiryReminder({ ...payload, expires_at: "2026-12-05" })).toBeNull();
    expect(parseDraftExpiryReminder({ ...payload, expires_at: "2026-13-45T00:00:00Z" })).toBeNull();
    expect(parseDraftExpiryReminder({ ...payload, recipient_email: undefined })).toBeNull();
  });

  it("says when the draft closes, in words, and how to keep it", () => {
    const r = renderDraftExpiryReminder(parseDraftExpiryReminder(payload)!, ctx);
    expect(r.subject).toBe("Heads up: your intake for Acme Co closes on 5 December 2026");
    expect(r.text).toContain("will close on 5 December 2026 (UTC)");
    expect(r.text).toContain("any change keeps it open");
    expect(r.text).toContain("https://app.example.com/start?session=s1");
    expect(r.text).toContain("If you don't need it anymore, there's nothing you need to do.");
    expect(r.text).not.toContain("File ID");
  });

  it("says why it was sent and how to stop them", () => {
    const r = renderDraftExpiryReminder(parseDraftExpiryReminder(payload)!, ctx);
    expect(r.text).toContain('You\'re getting this because you asked us to remind you. To stop these reminders, untick "Email me before an unfinished intake closes" on your profile');
    expect(r.text).toContain("https://app.example.com/profile");
    expect(r.html).toContain('href="https://app.example.com/profile"');
  });

  it("reads as about the prospect's company only when it has one", () => {
    const r = renderDraftExpiryReminder(parseDraftExpiryReminder({ ...payload, company_name: null, recipient_name: null })!, ctx);
    expect(r.subject).toBe("Heads up: your intake for your company closes on 5 December 2026");
    expect(r.text.startsWith("Hi there,\n")).toBe(true);
  });

  it("never carries intake contents a payload might hold", () => {
    const r = renderDraftExpiryReminder(parseDraftExpiryReminder({ ...leaky, ...payload })!, ctx);
    for (const value of SENSITIVE) {
      expect(r.text).not.toContain(value);
      expect(r.html).not.toContain(value);
    }
  });
});

describe("PEO mail notice", () => {
  const url = "https://app.example.com/advisor/submissions/abc";
  const n = { reference: "EAA-2026-0042", companyName: "Harbor Street Bakery LLC", peoName: "TriNet" };

  it("names the PEO, the employer and the File ID, and links to the thread", () => {
    const m = renderPeoMailArrived(n, { reviewUrl: url });
    expect(m.subject).toBe("New PEO mail: TriNet on Harbor Street Bakery LLC (EAA-2026-0042)");
    expect(m.text).toContain("PEO: TriNet");
    expect(m.text).toContain("File ID: EAA-2026-0042");
    expect(m.text).toContain(url);
    expect(m.html).toContain(`href="${url}"`);
    expect(m.text).toContain("carries nothing from the message");
  });

  it("copes with no company name and escapes what it shows", () => {
    expect(renderPeoMailArrived({ ...n, companyName: null }, { reviewUrl: url }).subject).toContain("Company name not provided");
    const m = renderPeoMailArrived({ ...n, peoName: "<b>Evil</b>" }, { reviewUrl: url });
    expect(m.html).not.toContain("<b>Evil</b>");
    expect(m.html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
  });

  it("reads only the File ID, the company and the PEO from a payload", () => {
    expect(parsePeoMailArrived({ reference: "EAA-1", company_name: "Acme", peo_name: "TriNet", body_text: "secret", from_address: "x@y.example" }))
      .toEqual({ reference: "EAA-1", companyName: "Acme", peoName: "TriNet" });
    expect(parsePeoMailArrived({ peo_name: "TriNet" })).toBeNull();
    expect(parsePeoMailArrived({ reference: "EAA-1" })).toBeNull();
    expect(parsePeoMailArrived("nope")).toBeNull();
  });
});
