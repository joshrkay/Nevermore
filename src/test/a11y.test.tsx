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

  it("leaves out what the keyboard skips: a drop zone's hidden file field, a heading focused only by the page", () => {
    render(
      <div>
        <input type="file" tabIndex={-1} style={{ display: "none" }} />
        <h2 tabIndex={-1}>Review</h2>
      </div>,
    );
    expect(() => expectEveryControlNamed()).not.toThrow();
  });

  it.each([
    ["an icon-only button", <button type="button"><svg aria-hidden="true" /></button>, /<button type="button">/],
    ["a field with only a placeholder", <input type="text" placeholder="Type a message..." />, /placeholder="Type a message..."/],
    ["a field whose label isn't tied to it", <div><label>Email</label><input type="email" /></div>, /<input type="email">/],
    ["an unnamed tab", <div role="tablist"><button type="button" role="tab" /></div>, /role="tab"/],
    // No control role of their own, but the keyboard stops on them.
    ["an unlabelled password field", <input type="password" />, /<input type="password">/],
    ["an unlabelled file field", <input type="file" />, /<input type="file">/],
    [
      "a focusable drop zone with no name",
      <div role="presentation" tabIndex={0}><p>Drag & drop files here</p></div>,
      /role="presentation" tabindex="0"/,
    ],
  ])("fails on %s, and names it", (_label, ui, culprit) => {
    render(ui);
    expect(() => expectEveryControlNamed()).toThrow(/Controls with no accessible name/);
    expect(() => expectEveryControlNamed()).toThrow(culprit);
  });
});
