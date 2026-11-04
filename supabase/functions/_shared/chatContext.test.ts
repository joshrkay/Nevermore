import { describe, expect, it } from "vitest";
import { chatContext, MAX_CONTEXT_CHARS, MAX_RECENT_CHARS, MAX_RECENT_MESSAGES } from "./chatContext";

const msg = (id: string, sender: string, text: string) => ({ id, sender, text });

describe("chatContext (D22)", () => {
  it("carries the answers, their statuses and the last messages, oldest first", () => {
    const transcript = Array.from({ length: 14 }, (_, i) => msg(`m${i}`, i % 2 ? "user" : "lenore", `line ${i}`));
    const built = chatContext({ company_name: "Acme" }, { company_name: "confirmed" }, transcript);
    expect(built.context).toEqual({ company_name: "Acme" });
    expect(built.statuses).toEqual({ company_name: "confirmed" });
    expect(built.recent).toHaveLength(MAX_RECENT_MESSAGES);
    expect(built.recent[0].text).toBe("line 4");
    expect(built.recent.at(-1)).toEqual({ sender: "user", text: "line 13" });
  });

  it("leaves out the message being sent and the Chamber's own notes", () => {
    const built = chatContext({}, {}, [
      msg("m1", "lenore", "Does anyone work in California?"),
      msg("m2", "system", "Voice call started"),
      msg("m3", "user", "Yes"),
    ], "m3");
    expect(built.recent).toEqual([{ sender: "lenore", text: "Does anyone work in California?" }]);
  });

  it("cuts a long message and drops the oldest until everything fits", () => {
    const long = "x".repeat(MAX_RECENT_CHARS + 50);
    const one = chatContext({}, {}, [msg("m1", "user", long)]);
    expect(one.recent[0].text).toHaveLength(MAX_RECENT_CHARS);

    const answers = { key_challenges: "a".repeat(9000), business_goals: "b".repeat(9000) };
    const crowded = chatContext(answers, {}, Array.from({ length: 10 }, (_, i) => msg(`m${i}`, "user", "c".repeat(500))));
    expect(JSON.stringify(crowded.context).length + JSON.stringify(crowded.statuses).length + JSON.stringify(crowded.recent).length)
      .toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
    expect(crowded.recent.length).toBeGreaterThan(0);
    expect(crowded.recent.length).toBeLessThan(10);
  });
});
