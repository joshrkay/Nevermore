import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";
import { DiscardDialog } from "./DiscardDialog";

export interface UnsavedChangesGuard {
  /** Runs `proceed` now when nothing is unsaved; otherwise asks first and runs it only if the person chooses to discard. */
  ask: (proceed: () => void) => void;
  /** Call once a save has succeeded: what was typed is now saved, so leaving or closing asks nothing. */
  release: () => void;
  /** The question itself. Render it once, anywhere inside the form's page. */
  prompt: ReactNode;
}

// The router supports one blocker at a time (the last one registered wins), but a page can hold several forms: the add form and
// a row being edited. So every guard registers here, and only one of them (the oldest still mounted) holds the router's single
// blocker, which asks when ANY registered form has something unsaved.
const guards = new Map<number, () => boolean>();
const listeners = new Set<() => void>();
let version = 0;
let nextId = 0;
const notify = () => { version += 1; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => version;
const anyUnsaved = () => [...guards.values()].some((active) => active());
const oldest = () => Math.min(...guards.keys());

/** The one navigation blocker of the page. Mounted only by the oldest guard, and only under a data router (see App.tsx). */
const NavigationBlocker = ({ returnFocusTo }: { returnFocusTo: React.MutableRefObject<HTMLElement | null> }) => {
  useSyncExternalStore(subscribe, snapshot);
  const blocker = useBlocker(() => {
    const unsaved = anyUnsaved();
    if (unsaved && document.activeElement instanceof HTMLElement) returnFocusTo.current = document.activeElement;
    return unsaved;
  });
  // A save that finishes while the question is open leaves nothing to lose: the move the person asked for goes ahead.
  useEffect(() => {
    if (blocker.state === "blocked" && !anyUnsaved()) blocker.proceed();
  });
  return (
    <DiscardDialog
      open={blocker.state === "blocked" && anyUnsaved()}
      onKeep={() => blocker.state === "blocked" && blocker.reset()}
      onDiscard={() => blocker.state === "blocked" && blocker.proceed()}
      returnFocusTo={returnFocusTo}
    />
  );
};

/**
 * CRM-S4.1: a form with unsaved changes asks before it is closed. Three ways out are covered: the form's own closing
 * (the caller routes it through `ask`: a Cancel button, Escape, a dialog's close), the app moving to another page, and the
 * browser's own leave-page prompt (closing the tab, reload, an outside link). Nothing is asked when nothing changed, or
 * after `release()` once a save went through.
 */
export function useUnsavedChangesGuard(dirty: boolean): UnsavedChangesGuard {
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const released = useRef(false);
  if (!dirty) released.current = false;
  const activeRef = useRef(false);
  activeRef.current = dirty && !released.current;
  const [pending, setPending] = useState<(() => void) | null>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) idRef.current = nextId++;
  const id = idRef.current;
  const isActive = useCallback(() => activeRef.current, []);

  useEffect(() => {
    guards.set(id, isActive);
    notify();
    return () => { guards.delete(id); notify(); };
  }, [id, isActive]);
  const active = activeRef.current;
  useEffect(() => { notify(); }, [active]);
  const holdsBlocker = useSyncExternalStore(subscribe, () => guards.has(id) && oldest() === id);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!activeRef.current) return;
      e.preventDefault();
      e.returnValue = ""; // some browsers still need this to show their own prompt
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  const ask = useCallback((proceed: () => void) => {
    if (activeRef.current) {
      if (document.activeElement instanceof HTMLElement) returnFocusTo.current = document.activeElement;
      setPending(() => proceed);
    } else proceed();
  }, []);
  const release = useCallback(() => {
    released.current = true;
    activeRef.current = false; // at once: a move made in the same breath as the save must not be asked about
    notify();
  }, []);

  const prompt = (
    <>
      <DiscardDialog
        open={pending !== null}
        onKeep={() => setPending(null)}
        onDiscard={() => { const run = pending; setPending(null); run?.(); }}
        returnFocusTo={returnFocusTo}
      />
      {dataRouter && holdsBlocker ? <NavigationBlocker returnFocusTo={returnFocusTo} /> : null}
    </>
  );
  return { ask, release, prompt };
}
