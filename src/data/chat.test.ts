import { describe, expect, it } from "vitest";
import { parseTranscript } from "./chat";

describe("parseTranscript", () => {
  it("returns an empty transcript for non-arrays", () => {
    expect(parseTranscript(null)).toEqual([]);
    expect(parseTranscript({ text: "hi" })).toEqual([]);
  });

  it("keeps well-formed messages and skips malformed ones", () => {
    const parsed = parseTranscript([
      { id: "1", sender: "lenore", text: "Hello", timestamp: "09:00" },
      { id: "2", sender: "robot", text: "nope" },
      { sender: "user", text: "Hi" },
      "junk",
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ id: "1", sender: "lenore", text: "Hello", timestamp: "09:00" });
    expect(parsed[1]).toMatchObject({ sender: "user", text: "Hi", timestamp: "" });
    expect(parsed[1].id).toBeTruthy();
  });
});
