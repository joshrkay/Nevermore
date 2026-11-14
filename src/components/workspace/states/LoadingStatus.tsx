/**
 * The one thing a screen reader hears while a page's data is on its way: "Loading submissions". A polite status that is on the page
 * from the first draw and never changes its words, so it is announced once, not again each time the page draws; the grey shapes beside it
 * are hidden from assistive technology. It is gone when the data arrives, which announces nothing.
 */
export function LoadingStatus({ name }: { name: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      Loading {name}
    </p>
  );
}
