import { toast } from "@/hooks/use-toast";
import { restoreAccount } from "@/lib/accountActionsApi";

/** What the screen knows of the account it acts on. `openOpportunities` is null when it is not known (the account's page holds only the first five). */
export interface ActionAccount {
  id: string;
  name: string;
  archived: boolean;
  ownerId: string | null;
  openOpportunities: number | null;
}

export const wordsOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** Restores an archived account at once (it takes nothing away, so it asks nothing first). Reports what the database said, in words. */
export async function restoreWithWords(firmId: string, account: ActionAccount): Promise<boolean> {
  try {
    await restoreAccount(firmId, account.id);
    toast({ title: `${account.name} is restored.` });
    return true;
  } catch (e) {
    toast({ title: "Couldn't restore the account", description: wordsOf(e, "Try again."), variant: "destructive" });
    return false;
  }
}

