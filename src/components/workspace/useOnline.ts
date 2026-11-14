import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/**
 * Whether the browser says it has a connection (CRM-S2.4a, D-182). It is the browser's word, so it can be wrong in both directions (a network
 * that is up but unreachable still reads as online): a request that fails is still a failure, said in its own place. It is read where saving needs
 * it (`useWorkspaceForm`) and by the banner, so the two cannot disagree. Outside a browser it is online.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
