import { Link, useLocation, useSearchParams } from "react-router-dom";
import { MAILBOX_PATH } from "./menu";

/** The address parameter a sign-in that couldn't connect the mailbox leaves on the page it returns to (src/pages/BrokerCallbackPage.tsx). */
const MAILBOX_FAILED_PARAM = "connect";

/**
 * Said on the page a broker comes back to after signing in with Google or Microsoft when the mailbox couldn't be connected (story M-4.1): the sign-in
 * returns to the page it was for (an export that asked for a fresh sign-in keeps its filters and its firm), so the failure is told there, in a line
 * with the way to try again, rather than by taking the person away from it. On the mailbox page the page says it itself. Dismissing it takes only its own
 * parameter out of the address.
 */
const MailboxNotice = () => {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  if (params.get(MAILBOX_FAILED_PARAM) !== "failed" || pathname === MAILBOX_PATH) return null;
  const dismiss = () =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(MAILBOX_FAILED_PARAM);
      return next;
    }, { replace: true });
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/40 bg-warning/10 px-6 py-3 text-sm">
      <p>
        <strong>We couldn't connect your mailbox.</strong>{" "}
        Either sending wasn't allowed on the Google or Microsoft screen, or the connection didn't go through. Until then you can send by hand from your own mail.
      </p>
      <Link to={MAILBOX_PATH} className="underline">Open your mailbox</Link>
      <button type="button" onClick={dismiss} className="underline">Dismiss</button>
    </div>
  );
};

export default MailboxNotice;
