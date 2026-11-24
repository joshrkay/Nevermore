import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillTemplate, TEMPLATE_KINDS, TEMPLATE_MAX, TEMPLATE_WORDS } from "./messageTemplates";

describe("a firm's message templates", () => {
  it("fills in the fields a template names and leaves every other word as typed", () => {
    expect(fillTemplate("Hi, about {company} ({file_id}, version {version}) sent {sent_on} to {market}.", { company: "Reyes Bakery", file_id: "EAA-2026-0042", version: 2, sent_on: "Nov 3, 2026", market: "Insperity" }))
      .toBe("Hi, about Reyes Bakery (EAA-2026-0042, version 2) sent Nov 3, 2026 to Insperity.");
    expect(fillTemplate("{company} {company}", { company: "Reyes" })).toBe("Reyes Reyes");
    expect(fillTemplate("Version {version}.", { version: null })).toBe("Version .");
    expect(fillTemplate("Keep {this} and { company }.", { company: "Reyes" })).toBe("Keep {this} and { company }.");
  });

  it("has words for each kind", () => {
    for (const k of TEMPLATE_KINDS) expect(TEMPLATE_WORDS[k].label).toBeTruthy();
  });

  it("keeps the kinds and the length the database keeps", () => {
    const sql = readFileSync("supabase/migrations/20261203090000_templates_and_reply.sql", "utf8");
    const block = sql.slice(sql.indexOf("-- sync:begin message_template_kinds"), sql.indexOf("-- sync:end message_template_kinds"));
    expect([...block.matchAll(/'(\w+)'/g)].map((m) => m[1])).toEqual([...TEMPLATE_KINDS]);
    expect(sql).toContain(`char_length(body) BETWEEN 1 AND ${TEMPLATE_MAX}`);
    expect(sql).toContain(`char_length(clean) > ${TEMPLATE_MAX}`);
  });
});
