import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectEveryControlNamed } from "./a11y";

describe("expectEveryControlNamed", () => {
  it("passes when every control has a name", () => {
    render(
      <div>
        <button type="button">Send</button>
        <button type="button" aria-label="Close" />
        <label htmlFor="email">Email</label>
        <input id="email" type="email" />
        <div role="tablist">
          <button type="button" role="tab">Upload</button>
        </div>
      </div>,
    );
    expect(() => expectEveryControlNamed()).not.toThrow();
  });

  it.each([
    ["an icon-only button", <button type="button"><svg aria-hidden="true" /></button>, /<button type="button">/],
    ["a field with only a placeholder", <input type="text" placeholder="Type a message..." />, /placeholder="Type a message..."/],
    ["a field whose label isn't tied to it", <div><label>Email</label><input type="email" /></div>, /<input type="email">/],
    ["an unnamed tab", <div role="tablist"><button type="button" role="tab" /></div>, /role="tab"/],
  ])("fails on %s, and names it", (_label, ui, culprit) => {
    render(ui);
    expect(() => expectEveryControlNamed()).toThrow(/Controls with no accessible name/);
    expect(() => expectEveryControlNamed()).toThrow(culprit);
  });
});
