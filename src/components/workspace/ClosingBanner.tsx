import { Link } from "react-router-dom";
import { useFirmClosure } from "@/hooks/useFirmClosure";
import { closingDate } from "@/lib/closeFirmApi";
import { SETTINGS_PATH } from "./menu";
import { useWorkspace } from "./useWorkspace";

/**
 * Shown on every page of the workspace while the firm is waiting to close (story CRM-P1.7): when it closes, that nothing can be
 * changed until then, and, to owners, how to take the request back. The database refuses every change itself; this only says so.
 */
const ClosingBanner = () => {
  const { firm, isOwner } = useWorkspace();
  const { closesAt } = useFirmClosure(firm?.id ?? null);
  if (!firm || !closesAt) return null;
  return (
    <div role="status" aria-label="This firm is closing" className="border-b border-destructive/40 bg-destructive/10 px-6 py-3 text-sm">
      <p>
        <strong>{firm.name} closes on {closingDate(closesAt)}.</strong>{" "}
        Until then you can read everything but nothing can be changed, added, sent or deleted.
        {isOwner ? (
          <> To keep the firm, withdraw the request in <Link to={SETTINGS_PATH} className="underline">Settings</Link> before that day.</>
        ) : (
          <> An owner can withdraw the request before then.</>
        )}
      </p>
    </div>
  );
};

export default ClosingBanner;
