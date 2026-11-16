import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFirmAddress } from "@/hooks/useFirmAddress";
import { fetchFirmTakesIntakes } from "@/lib/firmApi";
import { START_INTAKE_PATH } from "@/lib/firmHost";

/**
 * "Get a quote" on a firm's public page (P-2.1, D-1746): the link that starts an intake for the firm whose address the page is at. It leads to the intake's
 * start on this same address, where the browser names the firm to the database on every request and the database files the intake in it. Slice 8.7's page
 * places it; this is the entry alone. Pass `className` to style the link as the page's buttons.
 */
const GetAQuote = ({ className }: { className?: string }) => {
  const firm = useFirmAddress();
  const address = firm.status === "known" ? firm.address : null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (address === null) return;
    void fetchFirmTakesIntakes(address).then(setOpen, () => setOpen(true));
  }, [address]);

  if (!open) return null;
  return (
    <Link to={START_INTAKE_PATH} className={className}>
      Get a quote
    </Link>
  );
};

export default GetAQuote;
