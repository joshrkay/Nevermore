import { useEffect, useState } from "react";

/**
 * The one thing a screen reader hears while a page's data is on its way: "Loading submissions". A polite status that is on the page from
 * the first draw and FILLED just after, because some screen readers do not announce a live region that is inserted already holding
 * text. Its words never change, so it is announced once, not again each time the page draws; the grey shapes beside it are hidden from
 * assistive technology, and it is never inside an element marked busy (a busy region can hold its changes back). It is gone when the
 * data arrives, which announces nothing.
 */
export function LoadingStatus({ name }: { name: string }) {
  const [text, setText] = useState("");
  useEffect(() => setText(`Loading ${name}`), [name]);
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {text}
    </p>
  );
}
