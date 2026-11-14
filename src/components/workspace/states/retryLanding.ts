// Where focus goes when "Try again" is pressed (CRM-S2.3, D-175). The button can go as soon as the load starts again (the page draws its loading
// state in the failed one's place), and a browser drops the focus of a removed element to the page. So when the button is removed while it
// still had focus, focus goes to the element that stays: the panel (`section`) for a failed panel, the page's `main` for a failed page. When
// the failure is drawn again (the retry failed too) it takes focus back to its own "Try again" (`tookFocusBack`), so a person is never left
// on the page with nothing focused and the new alert is read once. A button that stays (the failure was never taken away) keeps its focus.
// Each failure has a KEY (`focusKey`): two panels can wait on one read (the PEO profiles), and only the one whose button was pressed takes focus
// back. The mark of a press is believed only for a few seconds, and is dropped when the button never went (`forget`), so a later, unrelated
// failure (a refresh a minute on, another panel) does not take focus.

const BELIEVED_MS = 10_000;
let pressedAt = -Infinity;
let pressedKey = "";

/** Called by "Try again" when it is pressed. Returns what to call when the button is removed. */
export function pressed(button: HTMLElement, within: "section" | "main", key: string): () => void {
  pressedAt = Date.now();
  pressedKey = key;
  const landing = button.closest<HTMLElement>(within) ?? button.closest<HTMLElement>("main");
  return () => {
    if (!landing || !landing.isConnected) return;
    // Only if the focus really fell with the button: a person who has moved on keeps where they went.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (!landing.hasAttribute("tabindex")) {
      // Focusable for this moment only: it is made plain again when focus leaves it, so it is not a stop in the tab order.
      landing.setAttribute("tabindex", "-1");
      landing.classList.add("focus:outline-none");
      landing.addEventListener("blur", () => {
        landing.removeAttribute("tabindex");
        landing.classList.remove("focus:outline-none");
      }, { once: true });
    }
    landing.focus({ preventScroll: true });
  };
}

/** Called when the failure's button is still there after a press (the failure was never taken away): the press is spent. */
export function forget(key: string) {
  if (pressedKey === key) pressedAt = -Infinity;
}

/** Called when a failure is drawn: true once if it is the answer to a "Try again" just pressed on a failure with this key. */
export function tookFocusBack(key: string): boolean {
  const recent = Date.now() - pressedAt < BELIEVED_MS && pressedKey === key;
  if (recent) pressedAt = -Infinity;
  return recent;
}
