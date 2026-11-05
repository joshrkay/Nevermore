import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import {
  MIN_COLUMN,
  clampColumn,
  defaultColumn,
  maxColumn,
  stepColumn,
} from "@/data/columnLayout";

interface ColumnSplitterProps {
  /** What the prospect chose, in pixels; null is the default, which the page works out from the window. */
  width: number | null;
  /** A width, or null to go back to the default. */
  onChange: (width: number | null) => void;
  /** The column this divider sizes, measured when a drag starts since its default width is a share of the window. */
  columnRef: RefObject<HTMLElement>;
  /** The id of the column. */
  controls: string;
}

/**
 * The divider between the conversation's column and the workspace: drag it to give either side more room, use the
 * arrow keys (Shift for bigger steps; Home and End for the narrowest and widest), or double-click to go back to
 * the default. Touching it never starts a drag on anything else: it has its own hit area, just right of the line.
 */
const ColumnSplitter = ({ width, onChange, columnRef, controls }: ColumnSplitterProps) => {
  // Where a drag began and how wide the column was, so each move is measured from the start.
  const drag = useRef<{ x: number; start: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const viewport = () => window.innerWidth;
  const current = () => width ?? columnRef.current?.getBoundingClientRect().width ?? defaultColumn(viewport());

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, start: current() };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const started = drag.current;
    if (!started) return;
    onChange(clampColumn(started.start + (e.clientX - started.x), viewport()));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowRight":
        onChange(stepColumn(current(), 1, viewport(), e.shiftKey));
        break;
      case "ArrowLeft":
        onChange(stepColumn(current(), -1, viewport(), e.shiftKey));
        break;
      case "Home":
        onChange(MIN_COLUMN);
        break;
      case "End":
        onChange(maxColumn(viewport()));
        break;
      case "Enter":
        onChange(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const now = Math.round(width === null ? defaultColumn(viewport()) : clampColumn(width, viewport()));

  return (
    // The visible line takes one pixel of the row; the hit area around it, wider, doesn't take any.
    <div className="relative w-px shrink-0 bg-border">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the conversation"
        aria-controls={controls}
        aria-valuemin={MIN_COLUMN}
        aria-valuemax={maxColumn(viewport())}
        aria-valuenow={now}
        aria-valuetext={`${now} pixels wide`}
        title="Drag to resize. Double-click to reset."
        tabIndex={0}
        data-testid="column-handle"
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onDoubleClick={() => onChange(null)}
        onKeyDown={onKeyDown}
        className="group absolute inset-y-0 -left-0.5 z-10 w-2.5 cursor-col-resize touch-none select-none focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0.5 w-0.5 bg-transparent transition-colors group-hover:bg-primary/40 group-focus-visible:bg-primary group-data-[dragging]:bg-primary"
        />
      </div>
    </div>
  );
};

export default ColumnSplitter;
