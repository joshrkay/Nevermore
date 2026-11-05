import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  MAX_ORB,
  PULL_OPEN_DISTANCE,
  dragStage,
  stepStage,
  toggleStage,
  type StageLayout,
} from "@/data/stageLayout";

interface StageSplitterProps {
  layout: StageLayout;
  onChange: (layout: StageLayout) => void;
  /** The id of the stage this handle resizes. */
  controls: string;
}

/**
 * The handle under Lenore's stage: drag it to make the orb smaller or larger, pull it past the smallest orb to
 * fold the stage into a slim bar, or use the button, a double click, or the keyboard (arrows, Home, End, Enter).
 * Everything below it, the conversation and the workspace, takes the room.
 */
const StageSplitter = ({ layout, onChange, controls }: StageSplitterProps) => {
  // Where a drag began, and the layout then, so each move is measured from the start and a pull that went too
  // far comes back to the same place when the pointer does.
  const drag = useRef<{ y: number; start: StageLayout } | null>(null);
  const [dragging, setDragging] = useState(false);

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, start: layout };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const delta = e.clientY - current.y;
    if (current.start.collapsed) {
      // A folded bar opens with one pull down, to the size it had. It doesn't follow the pointer: the open stage
      // is taller than the bar, so the handle would run ahead of it.
      if (delta >= PULL_OPEN_DISTANCE) {
        onChange({ ...current.start, collapsed: false });
        endDrag();
      }
      return;
    }
    onChange(dragStage(current.start, delta));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowDown":
        onChange(stepStage(layout, 1));
        break;
      case "ArrowUp":
        onChange(stepStage(layout, -1));
        break;
      case "Home":
        onChange({ ...layout, collapsed: true });
        break;
      case "End":
        onChange({ ...layout, collapsed: false });
        break;
      case "Enter":
      case " ":
        onChange(toggleStage(layout));
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const { collapsed } = layout;
  const ToggleIcon = collapsed ? ChevronDown : ChevronUp;
  const toggleLabel = collapsed ? "Show the orb" : "Hide the orb";

  return (
    <div className="relative h-8 md:h-6 shrink-0 border-y border-border bg-card">
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize Lenore's panel"
        aria-controls={controls}
        aria-valuemin={0}
        aria-valuemax={MAX_ORB}
        aria-valuenow={collapsed ? 0 : layout.size}
        aria-valuetext={collapsed ? "Folded into a bar" : `Open, orb ${layout.size} pixels`}
        tabIndex={0}
        data-testid="stage-handle"
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onDoubleClick={() => onChange(toggleStage(layout))}
        onKeyDown={onKeyDown}
        className="group absolute inset-0 flex cursor-row-resize touch-none select-none items-center justify-center hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring data-[dragging]:bg-muted"
      >
        <span
          aria-hidden="true"
          className="h-1 w-12 rounded-full bg-muted-foreground/40 transition-colors group-hover:bg-muted-foreground/70 group-data-[dragging]:bg-primary"
        />
      </div>
      {/* Beside the handle rather than inside it, so pressing it never starts a drag. */}
      <button
        type="button"
        onClick={() => onChange(toggleStage(layout))}
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        aria-controls={controls}
        className="absolute right-2 top-1/2 flex h-7 -translate-y-1/2 items-center gap-1 rounded px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="hidden sm:inline" aria-hidden="true">{collapsed ? "Show orb" : "Hide orb"}</span>
        <ToggleIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};

export default StageSplitter;
