// Where focus goes when "Try again" is pressed (CRM-S2.3, D-175). The button can go as soon as the load starts again (the page draws its loading
// state in the failed one's place), and a browser drops the focus of a removed element to the page. So when the button is removed while it
// still had focus, focus goes to the element that stays: the panel (`section`) for a failed panel, the page's `main` for a failed page. When
// the failure is drawn again (the retry failed too) it takes focus back to its own "Try again" (`tookFocusBack`), so a person is never left
// on the page with nothing focused and the new alert is read once. A button that stays (the failure was never taken away) keeps its focus.
// The mark of a press is believed only for a few seconds, so a later, unrelated failure (a refresh a minute on) does not take focus.

const BELIEVED_MS = 10_000;
let pressedAt = -Infinity;

/** Called by "Try again" when it is pressed. Returns what to call when the button is removed. */
export function pressed(button: HTMLElement, within: "section" | "main"): () => void {
  pressedAt = Date.now();
  const landing = button.closest<HTMLElement>(within) ?? button.closest<HTMLElement>("main");
  return () => {
    if (!landing || !landing.isConnected) return;
    // Only if the focus really fell with the button: a person who has moved on keeps where they went.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (!landing.hasAttribute("tabindex")) {
      landing.setAttribute("tabindex", "-1");
      landing.classList.add("focus:outline-none");
    }
    landing.focus({ preventScroll: true });
  };
}

/** Called when a failure is drawn: true once if it is the answer to a "Try again" just pressed. */
export function tookFocusBack(): boolean {
  const recent = Date.now() - pressedAt < BELIEVED_MS;
  pressedAt = -Infinity;
  return recent;
}
