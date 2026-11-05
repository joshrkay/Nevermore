import { useCallback, useEffect, useRef, useState } from "react";
import { forgetColumn, readStoredColumn, storeColumn } from "@/data/columnLayout";

/**
 * The width of the conversation's column, which the prospect can drag (see src/data/columnLayout.ts). Null is the
 * default, which the page's own layout works out from the window, so it follows the window until the prospect
 * chooses a width. What they chose is kept in this browser; going back to the default forgets it.
 */
export function useColumnWidth() {
  const [width, setWidth] = useState<number | null>(readStoredColumn);
  const chosen = useRef(false);

  const change = useCallback((next: number | null) => {
    chosen.current = true;
    setWidth(next);
  }, []);

  useEffect(() => {
    if (!chosen.current) return;
    if (width === null) forgetColumn();
    else storeColumn(width);
  }, [width]);

  return { width, change };
}
