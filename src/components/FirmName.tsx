import { useFirmAddress } from "@/hooks/useFirmAddress";

/** The firm's name above a sign-in, at a firm's address; nothing on the bare domain (story CRM-P1.3a). */
const FirmName = () => {
  const firm = useFirmAddress();
  if (firm.status !== "known") return null;
  return (
    <p data-testid="firm-name" className="text-sm font-semibold text-center text-primary mb-2">
      {firm.name}
    </p>
  );
};

export default FirmName;
