import { useEffect, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * What failed when a save did, in plain words, beside the buttons of the form or panel it belongs to (CRM-S2.3, D-178). An alert, announced once
 * as it appears. It never replaces what the person typed and never closes the form. Save was disabled while the request ran, so the browser dropped
 * its focus: give the button as `returnFocusTo` and focus goes back to it when the words appear.
 */
export function SaveFailed({ message, returnFocusTo, className }: { message: string | null; returnFocusTo?: RefObject<HTMLElement>; className?: string }) {
  useEffect(() => {
    if (message) returnFocusTo?.current?.focus();
  }, [message, returnFocusTo]);
  if (!message) return null;
  return <p role="alert" className={cn("text-sm font-medium text-destructive", className)}>{message}</p>;
}
