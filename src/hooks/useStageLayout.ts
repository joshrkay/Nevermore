import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultStageLayout,
  readStoredStage,
  storeStage,
  toggleStage,
  type StageLayout,
} from "@/data/stageLayout";

/**
 * The size of Lenore's stage, which the prospect can drag or fold (see src/data/stageLayout.ts). What they chose
 * is kept in this browser; until they choose, nothing is stored, so a window that is short today doesn't fix a
 * folded stage for the day they open a tall one.
 */
export function useStageLayout() {
  const [layout, setLayout] = useState<StageLayout>(
    () => readStoredStage() ?? defaultStageLayout({ width: window.innerWidth, height: window.innerHeight }),
  );
  const chosen = useRef(false);

  const change = useCallback((next: StageLayout | ((prev: StageLayout) => StageLayout)) => {
    chosen.current = true;
    setLayout(next);
  }, []);

  useEffect(() => {
    if (chosen.current) storeStage(layout);
  }, [layout]);

  const collapse = useCallback(() => change((prev) => (prev.collapsed ? prev : { ...prev, collapsed: true })), [change]);
  const toggle = useCallback(() => change(toggleStage), [change]);

  return { layout, change, collapse, toggle };
}
