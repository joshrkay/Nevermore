import { useEffect, useState } from "react";
import PacketRecipients from "@/components/PacketRecipients";
import { useAuth } from "@/hooks/useAuth";
import { PEO_AUTHORIZATION_PROFILE_HEADING } from "@/data/legalWording";
import { listMyCertifiedIntakes, type MyCertifiedIntake } from "@/lib/peoAuthorizationsApi";

/** The employer's profile: which PEOs may receive the packet of each certified intake, to add or withdraw at any time (M-1.1, D-608). */
const MyPacketRecipients = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [intakes, setIntakes] = useState<MyCertifiedIntake[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listMyCertifiedIntakes(userId).then(
      (rows) => {
        if (!cancelled) setIntakes(rows);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <section aria-labelledby="my-packet-recipients" className="space-y-3">
      <h2 id="my-packet-recipients" className="font-medium text-foreground">{PEO_AUTHORIZATION_PROFILE_HEADING}</h2>
      {loadFailed && <p role="alert" className="text-sm">We couldn't load your packets. Reload the page to try again.</p>}
      {intakes?.length === 0 && (
        <p className="text-sm text-muted-foreground">Once you certify your intake, you can choose here which PEOs may receive its packet.</p>
      )}
      {intakes?.map((intake) => <PacketRecipients key={intake.id} sessionId={intake.id} heading={intake.company} />)}
    </section>
  );
};

export default MyPacketRecipients;
