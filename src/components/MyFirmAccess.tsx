import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SaveFailed } from "@/components/workspace/form";
import { DID_NOT_GO_THROUGH, useSaveFailure } from "@/components/workspace/form/failureWords";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DRAFT_WORDING_NOTICE, endFirmAccessText } from "@/data/legalWording";
import { endFirmAccess, listMyIntakeFirms, type MyIntakeFirm } from "@/lib/peoAuthorizationsApi";

/** The employer's profile: which firm can see each of their intakes, and the way to end it (CRM-P2.5, D-1714). */
const MyFirmAccess = () => {
  const [intakes, setIntakes] = useState<MyIntakeFirm[] | null>(null);
  const [ended, setEnded] = useState<string[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [asking, setAsking] = useState<MyIntakeFirm | null>(null);
  const failure = useSaveFailure(DID_NOT_GO_THROUGH);

  useEffect(() => {
    let cancelled = false;
    listMyIntakeFirms().then(
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
  }, []);

  const end = async (intake: MyIntakeFirm) => {
    failure.clear();
    try {
      await endFirmAccess(intake.id);
    } catch (error) {
      failure.failed(error);
      return;
    }
    setEnded((done) => [...done, intake.id]);
  };

  return (
    <section aria-labelledby="my-firm-access" className="space-y-3">
      <h2 id="my-firm-access" className="font-medium text-foreground">Who can see my intake</h2>
      {loadFailed && <p role="alert" className="text-sm">We couldn't load who can see your intake. Reload the page to try again.</p>}
      {intakes?.length === 0 && <p className="text-sm text-muted-foreground">No firm can see your intake.</p>}
      {intakes?.map((intake) => (
        <div key={intake.id} className="flex flex-wrap items-center justify-between gap-2">
          {ended.includes(intake.id) ? (
            <p className="text-sm">{intake.firm} can no longer see {intake.company}.</p>
          ) : (
            <>
              <p className="text-sm">{intake.company} is seen by {intake.firm}.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setAsking(intake)}>End {intake.firm}'s access</Button>
            </>
          )}
        </div>
      ))}
      <SaveFailed message={failure.message} />
      <AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End {asking?.firm}'s access?</AlertDialogTitle>
            <AlertDialogDescription>{asking ? endFirmAccessText(asking.firm) : ""}</AlertDialogDescription>
            <p className="text-xs text-muted-foreground">{DRAFT_WORDING_NOTICE}</p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep {asking?.firm}'s access</AlertDialogCancel>
            <AlertDialogAction onClick={() => asking && end(asking)}>End {asking?.firm}'s access</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default MyFirmAccess;
