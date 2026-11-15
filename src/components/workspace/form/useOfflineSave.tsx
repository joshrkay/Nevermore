import { useId, type CSSProperties, type ReactNode } from "react";
import { useOnline } from "../useOnline";
import { OFFLINE_SAVE_REASON } from "./offline";

/**
 * For a panel that saves from a button of its own, not a `useWorkspaceForm` form (CRM-S2.4a, D-182, D-143): with no connection the button is
 * `aria-disabled` (in the tab order, the click ignored) with the reason beside it and as its description, the same words a form's Save says.
 * Spread `buttonProps` on the button, put `reason` beside it, and make the click do nothing while `offline` (`guard(handler)` does that).
 */
export function useOfflineSave() {
  const offline = !useOnline();
  const reasonId = useId();
  const buttonProps: { "aria-disabled"?: true; "aria-describedby"?: string; style?: CSSProperties } = offline
    ? { "aria-disabled": true, "aria-describedby": reasonId, style: { opacity: 0.5 } }
    : {};
  const reason: ReactNode = offline ? <p id={reasonId} className="text-xs text-muted-foreground">{OFFLINE_SAVE_REASON}</p> : null;
  const guard = <A extends unknown[]>(handler: (...args: A) => unknown) => (...args: A) => (offline ? undefined : handler(...args));
  return { offline, buttonProps, reason, guard };
}
