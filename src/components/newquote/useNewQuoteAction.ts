import { useLocation } from "react-router-dom";
import type { EmptyAction } from "@/components/workspace/states";
import { NEW_QUOTE_PATH } from "@/components/workspace/menu";

/** New quote as an action a page offers (an empty state's primary action): it opens over the page it is offered on, which `state.backgroundLocation` says (D-1709). */
export function useNewQuoteAction(): EmptyAction {
  const location = useLocation();
  return { label: "New quote", to: NEW_QUOTE_PATH, state: { backgroundLocation: location } };
}
