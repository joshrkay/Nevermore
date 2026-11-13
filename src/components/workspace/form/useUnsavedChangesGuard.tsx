import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { UNSAFE_DataRouterContext } from "react-router-dom";
import { DiscardDialog, NavigationBlocker } from "./DiscardDialog";

export interface UnsavedChangesGuard {
  /** Runs `proceed` now when nothing is unsaved; otherwise asks first and runs it only if the person chooses to discard. */
  ask: (proceed: () => void) => void;
  /** Call once a save has succeeded: what was typed is now saved, so leaving or closing asks nothing. */
  release: () => void;
  /** The question itself. Render it once, anywhere inside the form's page. */
  prompt: ReactNode;
}

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
    if (activeRef.current) setPending(() => proceed);
    else proceed();
  }, []);
  const release = useCallback(() => {
    released.current = true;
    activeRef.current = false; // at once: a move made in the same breath as the save must not be asked about
  }, []);
  const isActive = useCallback(() => activeRef.current, []);

  const prompt = (
    <>
      <DiscardDialog
        open={pending !== null}
        onKeep={() => setPending(null)}
        onDiscard={() => { const run = pending; setPending(null); run?.(); }}
      />
      {/* The router keeps one blocker (the last one registered), so a form holds it only while it has something to lose. */}
      {dataRouter && activeRef.current ? <NavigationBlocker active={isActive} /> : null}
    </>
  );
  return { ask, release, prompt };
}
