import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { fetchFirmTakesIntakes } from "@/lib/firmApi";
import { START_INTAKE_PATH } from "@/lib/firmHost";

/**
 * "Get a quote" on a firm's public page (P-2.1, D-1713): the link that starts an intake for the firm whose address the page is at. It is a link to the
 * intake's start on this same address, where the browser names the firm to the database on every request (src/integrations/supabase/client.ts) and the
 * database files the intake in it. Shown only at a firm's address and only while the firm's link takes intakes (`firm_takes_intakes`), so there is no
 * button that leads to a refusal (D-402). Slice 8.7's public page places it beside "Ask to be contacted"; the page of that slice owns the layout, this is
 * the entry alone. Pass `className` to style the link as the page's buttons.
 */
const GetAQuote = ({ className }: { className?: string }) => {
  const firm = useFirmAddress();
  const address = firm.status === "known" ? firm.address : null;
  const [answer, setAnswer] = useState<{ address: string; open: boolean } | null>(null);

  useEffect(() => {
    if (address === null) return;
    let cancelled = false;
    fetchFirmTakesIntakes(address).then(
      (open) => !cancelled && setAnswer({ address, open }),
      // No answer is no refusal: the database refuses a start the link can't take, and the intake says so.
      () => !cancelled && setAnswer({ address, open: true }),
    );
    return () => { cancelled = true; };
  }, [address]);

  if (address === null || answer?.address !== address || !answer.open) return null;
  return (
    <Link to={START_INTAKE_PATH} className={className}>
      Get a quote
    </Link>
  );
};

export default GetAQuote;
