import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WCAG 2.1 AA contrast for the theme's colours (I-2.3), worked out from the tokens in src/index.css, so a
// change to a token that breaks contrast fails here. Text needs 4.5:1 (the Chamber's small 9-12 px text is
// never "large"), and a focus ring or a control's outline needs 3:1 against what is next to it.

const css = readFileSync("src/index.css", "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));

type Rgb = [number, number, number];

function token(name: string): Rgb {
  const match = root.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%;`));
  if (!match) throw new Error(`--${name} is not an HSL token in :root`);
  return hslToRgb(Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100);
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

const luminance = ([r, g, b]: Rgb) => {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` at `alpha` opacity over `bg`, as Tailwind's `text-x/50` draws it. */
const over = (fg: Rgb, alpha: number, bg: Rgb): Rgb => fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]) as Rgb;

// The surfaces text sits on: the page, cards and panels, and muted boxes (inputs, chat bubbles, document rows).
const SURFACES = ["background", "card", "muted"] as const;

describe("theme contrast (WCAG 2.1 AA)", () => {
  it("reads the tokens it checks", () => {
    expect(contrast([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(token("background")).toHaveLength(3);
  });

  it.each(["foreground", "muted-foreground"])("%s text is 4.5:1 or better on every surface", (text) => {
    for (const surface of SURFACES) {
      expect(contrast(token(text), token(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(["success", "warning", "destructive"])("%s text is 4.5:1 or better on every surface", (text) => {
    for (const surface of SURFACES) {
      expect(contrast(token(text), token(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ["primary-foreground", "primary"],
    ["secondary-foreground", "secondary"],
    ["destructive-foreground", "destructive"],
    ["warning-foreground", "warning"],
  ])("%s text is 4.5:1 or better on a %s button", (text, fill) => {
    expect(contrast(token(text), token(fill))).toBeGreaterThanOrEqual(4.5);
  });

  // Known gap, still open in I-2.3: the brand crimson and violet are under 4.5:1 as text (about 3.3:1), and
  // are used that way for "Required", links and small labels. Changing them is a design decision. These are
  // expected to fail; when the colours are fixed, vitest reports them, and they become ordinary tests.
  it.fails.each(["primary", "secondary"])("%s text is 4.5:1 or better on every surface (known gap)", (text) => {
    for (const surface of SURFACES) {
      expect(contrast(token(text), token(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the focus ring is 3:1 or better against every surface", () => {
    for (const surface of SURFACES) {
      expect(contrast(token("ring"), token(surface)), `ring on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });

  // Fading muted text makes it fail (text-muted-foreground/50 was 1.8:1); only decoration may be faded.
  it("no source fades muted text below 4.5:1, except decoration", () => {
    const DECORATION = [
      "text-muted-foreground/10", // the DEMO DATA watermark on sample data (CompanyTab)
      "text-muted-foreground/30", // the tree lines beside dependents (DependentsTab), hidden from screen readers
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
          for (const [cls, pct] of readFileSync(path, "utf8").matchAll(/text-muted-foreground\/(\d+)/g)) {
            if (DECORATION.includes(cls)) continue;
            const worst = Math.min(...SURFACES.map((s) => contrast(over(token("muted-foreground"), Number(pct) / 100, token(s)), token(s))));
            if (worst < 4.5) offenders.push(`${path}: ${cls} (${worst.toFixed(2)}:1)`);
          }
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});
