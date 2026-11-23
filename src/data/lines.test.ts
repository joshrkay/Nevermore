import { describe, expect, it } from "vitest";
import { lineOf } from "./lines";

describe("lineOf", () => {
  // Catches: an opportunity read from a database that has no line yet (the site deploys before the migration is pushed), or a line a later migration adds
  // before this build knows it, drawn as a search for nothing: no quote form, no comparison rows.
  it("reads the line the database gave, and a PEO search when it gave none or one this build does not know", () => {
    expect(lineOf("workers_comp")).toBe("workers_comp");
    expect(lineOf("peo")).toBe("peo");
    expect(lineOf(undefined)).toBe("peo");
    expect(lineOf(null)).toBe("peo");
    expect(lineOf("commercial_auto")).toBe("peo");
    expect(lineOf(7)).toBe("peo");
  });
});
