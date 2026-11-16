import { useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormActions, SaveRefused, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { changedLine, commissionFieldLabel, commissionProblems } from "@/data/opportunityClose";
import { OpportunityError, setPlacementCommission, type OpportunityPlacement, type PlacementCommission } from "@/lib/opportunityPageApi";
import { CommissionFields } from "./CommissionFields";

// Add or change the commission later (D-466): the win may have been made with none. Saved from the placement's version as it was when the dialog opened (D-46); a stale
// save saves nothing and says who changed what, and only then does the dialog start from the version it named. "None recorded" clears it. Whoever may change the
// opportunity may (D-467); the database decides and says why in words.

const commissionSchema = z.object({ commission_basis: z.string(), commission_rate: z.string().trim(), commission_yearly: z.string().trim() })
  .superRefine((v, ctx) => { for (const p of commissionProblems(v)) ctx.addIssue({ code: "custom", path: [p.path], message: p.message }); });

export function PlacementCommissionDialog({ firmId, placement, adminFeePepm, employees, onClose, onChanged }: {
  firmId: string;
  placement: OpportunityPlacement;
  /** The admin fee of the quote that was won, which the share is worked from. */
  adminFeePepm: number | null;
  employees: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const c = placement.commission;
  const adding = c === null;
  const version = useRef(placement.version);
  const [conflicted, setConflicted] = useState(false);
  const leave = () => {
    if (conflicted) onChanged();
    onClose();
  };
  const api = useWorkspaceForm({
    schema: commissionSchema,
    defaultValues: { commission_basis: c?.basis ?? "", commission_rate: c ? String(c.rate) : "", commission_yearly: c?.expectedYearly != null ? String(c.expectedYearly) : "" },
    save: async (v) => {
      const commission: PlacementCommission | null = v.commission_basis === ""
        ? null
        : { basis: v.commission_basis as PlacementCommission["basis"], rate: Number(v.commission_rate), expectedYearly: v.commission_yearly === "" ? null : Number(v.commission_yearly) };
      try {
        const done = await setPlacementCommission(firmId, placement.id, commission, version.current);
        if (done.conflict) {
          version.current = done.currentVersion;
          setConflicted(true);
          throw new SaveRefused(
            `Someone else changed this commission first. Nothing was saved. ${done.changed.map((x) => changedLine(x, commissionFieldLabel)).join("; ")}${done.changed.length > 0 ? ". " : ""}Check it, and save again to keep your change.`,
          );
        }
        return done;
      } catch (e) {
        if (e instanceof OpportunityError && e.kind !== "failed") throw new SaveRefused(e.message);
        throw e;
      }
    },
    onSaved: () => {
      toast.success("Commission saved");
      onChanged();
      onClose();
    },
    failureMessage: "Couldn't save the commission. Check your connection and try again.",
    onCancel: leave,
  });
  const title = adding ? "Add commission" : "Change commission";
  return (
    <Dialog open onOpenChange={(open) => { if (!open) api.cancel?.(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>The commission expected for the {placement.peoName} placement. Choose None recorded to clear it.</DialogDescription>
        </DialogHeader>
        <WorkspaceForm api={api} aria-label={title} actions={<FormActions submitLabel="Save commission" savingLabel="Saving…" />}>
          <CommissionFields form={api.form} adminFeePepm={adminFeePepm} employees={employees} yearlyTyped={c?.expectedYearly != null} />
        </WorkspaceForm>
      </DialogContent>
    </Dialog>
  );
}
