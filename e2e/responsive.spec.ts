import { expect, test, type Page } from "@playwright/test";
import { agreeToIntakeConsent } from "./support/consent";

// The Chamber at phone, tablet and desktop widths (I-1.1, I-1.2): no page-wide sideways scrolling on any
// workspace tab or on the Manuscript, every control on a phone big enough to tap (44x44 px), the whole
// conversation a tap away, and every control named, with a focus ring the keyboard can see (I-2.1).
// 767px and below is the phone layout (useIsMobile).

const TABS = [
  ["① Upload", "Drop your documents here."],
  ["② Company", "Company Profile"],
  ["③ Payroll", "Payroll & Time"],
  ["④ Benefits", "Benefits"],
  ["⑤ Your Team", "Employee Census"],
  ["⑥ Dependents", "Dependents"],
  ["⑦ Review", "Review"],
  ["⑧ PEO Match", "PEO Match"],
  ["⑨ The Reckoning", "The Reckoning"],
] as const;

const PHONES = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
];
const WIDE = [
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

async function openChamber(page: Page) {
  await page.goto("/start");
  await agreeToIntakeConsent(page);
  await expect(page.getByRole("tab", { name: "① Upload", exact: true })).toBeVisible();
}

/** How far the page itself scrolls sideways. The tab bar and the census table scroll inside themselves, which is fine. */
const sidewaysOverflow = (page: Page) =>
  page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);

/** Visible controls smaller than 44x44 px, by name. Screen-reader-only and covered controls don't count. */
const smallControls = (page: Page) =>
  page.evaluate(() => {
    const selector = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"], [role="combobox"]';
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = el.getBoundingClientRect();
      // Hidden, or the 1px screen-reader-only pattern (the certification checkboxes have a visible stand-in).
      if (rect.width <= 1 || rect.height <= 1) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      // Half a pixel of slack: layout can land a 44px control at 43.99px, which no finger notices.
      if (rect.width >= 43.5 && rect.height >= 43.5) continue;
      const name = el.getAttribute("aria-label") || el.textContent?.trim() || el.getAttribute("placeholder") || el.tagName;
      small.push(`${name} (${Math.round(rect.width)}x${Math.round(rect.height)})`);
    }
    return small;
  });

for (const viewport of [...PHONES, ...WIDE]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("no workspace tab makes the page scroll sideways", async ({ page }) => {
      await openChamber(page);
      for (const [tab, heading] of TABS) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
        expect(await sidewaysOverflow(page), `${tab} at ${viewport.width}px`).toBeLessThanOrEqual(0);
      }
    });

    // The sample is laid out exactly as a prospect's own Manuscript, and needs no certified intake (I-1.2).
    test("the Manuscript doesn't make the page scroll sideways", async ({ page }) => {
      await page.goto("/manuscript/demo");
      await expect(page.getByText("THE MANUSCRIPT", { exact: true })).toBeVisible();
      expect(await sidewaysOverflow(page), `the Manuscript at ${viewport.width}px`).toBeLessThanOrEqual(0);
    });
  });
}

for (const viewport of PHONES) {
  test.describe(`on a ${viewport.width}px phone`, () => {
    test.use({ viewport, hasTouch: true });

    test("every control is at least 44x44 px, on every tab", async ({ page }) => {
      await openChamber(page);
      const found: string[] = [];
      for (const [tab] of TABS) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        for (const control of await smallControls(page)) found.push(`${tab}: ${control}`);
      }
      expect([...new Set(found)]).toEqual([]);
    });

    test("puts Review's answers in one column", async ({ page }) => {
      await openChamber(page);
      await page.getByRole("tab", { name: "⑦ Review", exact: true }).click();
      const company = page.getByRole("button", { name: "Add Company legal name", exact: true });
      const industry = page.getByRole("button", { name: "Add Industry", exact: true });
      const [a, b] = [await company.boundingBox(), await industry.boundingBox()];
      expect(a && b, "both answers are on screen").toBeTruthy();
      // Stacked, not side by side: the second starts below the first.
      expect(b!.y).toBeGreaterThan(a!.y);
    });

    test("sends from the chat bar and shows the whole conversation a tap away", async ({ page }) => {
      await openChamber(page);
      const input = page.getByRole("textbox", { name: "Message Lenore", exact: true });
      await input.fill("We're a bindery with 12 people.");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(input).toHaveValue("");
      await page.getByRole("button", { name: "Read the conversation", exact: true }).click();
      const sheet = page.getByRole("dialog", { name: "Conversation with Lenore" });
      await expect(sheet.getByText("We're a bindery with 12 people.")).toBeVisible();
      await expect(sheet.getByRole("textbox", { name: "Message Lenore", exact: true })).toBeVisible();
    });
  });
}

/**
 * Controls the browser's accessibility tree gives no name (I-2.1's automated name check). Chromium computes the
 * names, so a label, aria-label, aria-labelledby or the control's own text all count, as they do for a screen
 * reader.
 */
async function unnamedControls(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
      nodes: { ignored: boolean; role?: { value: string }; name?: { value: string } }[];
    };
    const CONTROLS = new Set(["button", "link", "textbox", "searchbox", "combobox", "checkbox", "radio", "switch", "tab", "slider", "spinbutton", "listbox", "menuitem"]);
    return nodes
      .filter((n) => !n.ignored && CONTROLS.has(n.role?.value ?? "") && !(n.name?.value ?? "").trim())
      .map((n) => n.role!.value);
  } finally {
    await cdp.detach();
  }
}

for (const viewport of [PHONES[1], WIDE[1]]) {
  test.describe(`names at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("every control on every tab has an accessible name", async ({ page }) => {
      await openChamber(page);
      const unnamed: string[] = [];
      for (const [tab] of TABS) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        for (const role of await unnamedControls(page)) unnamed.push(`${tab}: a ${role}`);
      }
      expect(unnamed).toEqual([]);
    });
  });
}

test.describe("the keyboard", () => {
  test("moves between tabs with the arrow keys and shows a focus ring", async ({ page }) => {
    await openChamber(page);
    await page.getByRole("tab", { name: "① Upload", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    const company = page.getByRole("tab", { name: "② Company", exact: true });
    await expect(company).toBeFocused();
    await expect(company).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Company Profile", exact: true })).toBeVisible();
    const ring = await company.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(ring).toEqual({ style: "solid", width: "2px" });
  });
});
