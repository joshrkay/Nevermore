import { useCallback, useRef, type MutableRefObject } from "react";
import type { WorkspaceFormApi } from "./useWorkspaceForm";

/**
 * The flag a form's `save` reads to tell "Save and add another" (or "Save and add a contact") from the plain Save: made before the form's own hook, because `save`
 * is one of its options. It is only ever set by `alternateSave`.
 */
export const useAlternateFlag = (): MutableRefObject<boolean> => useRef(false);

/**
 * Runs the form's submit as the alternate save: the flag is set for exactly this submit and cleared when it ends, whether the form's checks failed (so `save` was
 * never called) or the save ran, failed or went through. So a second save pressed on a form that fails its checks is never left armed for the next Enter. Nothing
 * is sent without a connection, as the plain Save does.
 */
export const useAlternateSave = (flag: MutableRefObject<boolean>, api: Pick<WorkspaceFormApi, "submit" | "offline">) =>
  useCallback(async () => {
    if (api.offline) return;
    flag.current = true;
    try {
      await api.submit();
    } finally {
      flag.current = false;
    }
  }, [flag, api]);
