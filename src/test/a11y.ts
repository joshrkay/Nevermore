import { within } from "@testing-library/react";
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

const describe = (el: HTMLElement) => el.outerHTML.slice(0, 160);

const hasName = (el: HTMLElement) => {
  try {
    expect(el).toHaveAccessibleName();
    return true;
  } catch {
    return false;
  }
};

/** Fails, listing each one, when any control in `container` has no accessible name. */
export function expectEveryControlNamed(container: HTMLElement = document.body): void {
  const controls = CONTROL_ROLES.flatMap((role) => within(container).queryAllByRole(role));
  const unnamed = controls.filter((control) => !hasName(control));
  if (unnamed.length > 0) {
    throw new Error(`Controls with no accessible name (${unnamed.length}):\n${unnamed.map(describe).join("\n")}`);
  }
}
