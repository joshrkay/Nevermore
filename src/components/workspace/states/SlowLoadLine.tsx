/**
 * The line under a page's title when a load is slow: "This is taking longer than usual" and "Try again". A polite status, so it is
 * announced once when it appears; nothing is drawn while `slow` is false. The controls that need the data stay disabled meanwhile.
 */
export function SlowLoadLine({ slow, onTryAgain }: { slow: boolean; onTryAgain: () => void }) {
  if (!slow) return null;
  return (
    <p role="status" aria-live="polite" className="mt-1 text-sm text-muted-foreground">
      This is taking longer than usual.{" "}
      <button type="button" onClick={onTryAgain} className="text-primary underline">Try again</button>
    </p>
  );
}
