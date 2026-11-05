import { isInaccessible, within } from "@testing-library/react";
import { expect } from "vitest";

// The roles a keyboard or screen-reader user operates. Each needs a name, or it is announced as just "button",
// "edit text" or "tab" (plan I-2.1).
const CONTROL_ROLES = [
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "slider",
  "spinbutton",
] as const;

// Whatever the keyboard can reach, whatever its role: a field with no role of its own (a password or file input),
// or a div made focusable (a drop zone), is a stop the user lands on and hears announced.
const FOCUSABLE = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[tabindex]",
].join(", ");

const keyboardStops = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && !isInaccessible(el),
  );

const snippet = (el: HTMLElement) => el.outerHTML.slice(0, 160);

const hasName = (el: HTMLElement) => {
  try {
    expect(el).toHaveAccessibleName();
    return true;
  } catch {
    return false;
  }
};

/**
 * Fails, listing each one, when a control in `container` has no accessible name: every element with a control
 * role, and every element the keyboard can reach.
 */
export function expectEveryControlNamed(container: HTMLElement = document.body): void {
  const controls = new Set([
    ...CONTROL_ROLES.flatMap((role) => within(container).queryAllByRole(role)),
    ...keyboardStops(container),
  ]);
  const unnamed = [...controls].filter((control) => !hasName(control));
  if (unnamed.length > 0) {
    throw new Error(`Controls with no accessible name (${unnamed.length}):\n${unnamed.map(snippet).join("\n")}`);
  }
}
