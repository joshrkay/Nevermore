import { describe, expect, it } from "vitest";
import { isNaicsCode, NAICS_2022, naicsTitle, searchNaics } from "./naics2022";

describe("the 2022 NAICS industries (K-1.2)", () => {
  it("holds every six-digit code once, in order, each with a title", () => {
    // The Census Bureau's count for the 2022 edition.
    expect(NAICS_2022).toHaveLength(1012);
    const codes = NAICS_2022.map(([code]) => code);
    expect(new Set(codes).size).toBe(1012);
    expect(codes).toEqual([...codes].sort());
    for (const [code, title] of NAICS_2022) {
      expect(code).toMatch(/^[0-9]{6}$/);
      expect(title.trim(), code).toBe(title);
      expect(title.length, code).toBeGreaterThan(3);
    }
  });

  it("knows a code's title, and that a made-up code isn't one", () => {
    expect(naicsTitle("541430")).toBe("Graphic Design Services");
    expect(naicsTitle("238160")).toBe("Roofing Contractors");
    expect(isNaicsCode("541430")).toBe(true);
    // 541710 was a 2012 code; it is not in the 2022 edition.
    expect(isNaicsCode("541710")).toBe(false);
    expect(isNaicsCode("999999")).toBe(false);
    expect(isNaicsCode(541430)).toBe(false);
    expect(naicsTitle("54143")).toBeUndefined();
  });

  it("finds industries by words of the title, in any order and case, best matches first", () => {
    expect(searchNaics("graphic design").map(([code]) => code)).toEqual(["541430"]);
    expect(searchNaics("DESIGN graphic")[0][0]).toBe("541430");
    const roofing = searchNaics("roofing");
    expect(roofing[0]).toEqual(["238160", "Roofing Contractors"]);
    // A title that starts with the word typed comes before one that only contains it, whatever their codes.
    expect(searchNaics("software").map(([code]) => code).slice(0, 2)).toEqual(["513210", "423430"]);
    expect(searchNaics("hotels")[0]).toEqual(["721110", "Hotels (except Casino Hotels) and Motels"]);
    const restaurants = searchNaics("restaurants").map(([, title]) => title);
    expect(restaurants).toContain("Full-Service Restaurants");
    expect(restaurants).toContain("Limited-Service Restaurants");
  });

  it("finds industries by the start of a code", () => {
    expect(searchNaics("5414").map(([code]) => code)).toEqual(["541410", "541420", "541430", "541490"]);
    expect(searchNaics("541430")).toEqual([["541430", "Graphic Design Services"]]);
  });

  it("returns nothing for an empty search or one that matches nothing, and at most the number asked for", () => {
    expect(searchNaics("")).toEqual([]);
    expect(searchNaics("  ")).toEqual([]);
    expect(searchNaics("zzzz")).toEqual([]);
    expect(searchNaics("manufacturing")).toHaveLength(20);
    expect(searchNaics("manufacturing", 5)).toHaveLength(5);
  });
});
