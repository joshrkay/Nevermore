/**
 * The line under a page's title when a load is slow: "This is taking longer than usual" and "Try again". A polite status that is on the
 * page from the first draw of the wait, empty, and FILLED at ten seconds (a live region inserted already holding text is not reliably
 * announced), so it is announced once. It is not drawn when nothing is being waited for. When there is nothing to ask again (the wait is
 * for something the page has not asked for yet), `waitingFor` says what it is waiting for and no button is offered. The controls that
 * need the data stay disabled meanwhile.
 */
export function SlowLoadLine({ loading, slow, onTryAgain, waitingFor }: { loading: boolean; slow: boolean; onTryAgain: () => void; waitingFor?: string }) {
  if (!loading) return null;
  return (
    <p role="status" aria-live="polite" className="mt-1 text-sm text-muted-foreground">
      {slow && (
        <>
          This is taking longer than usual.{" "}
          {waitingFor ? waitingFor : <button type="button" onClick={onTryAgain} className="text-primary underline">Try again</button>}
        </>
      )}
    </p>
  );
}
