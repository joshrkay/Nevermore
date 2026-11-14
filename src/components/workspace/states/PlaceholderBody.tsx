import { cn } from "@/lib/utils";
import { PlaceholderLine } from "./Placeholder";
import { PLACEHOLDER_ROWS, type PlaceholderColumn } from "./placeholderShapes";

/**
 * The grey rows themselves: a `tbody` hidden from assistive technology, each row as tall as a real row (the same cell padding and text
 * height). `cellClassName` is the real table's own cell padding where a page's table differs from the table frame's.
 */
export function PlaceholderBody({ columns, rows = PLACEHOLDER_ROWS, cellClassName = "px-4 py-3 align-top" }: { columns: PlaceholderColumn[]; rows?: number; cellClassName?: string }) {
  return (
    <tbody aria-hidden="true" aria-busy="true">
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-border last:border-0">
          {columns.map((column) => (
            <td key={column.id} className={cellClassName}>
              {Array.from({ length: column.lines ?? 1 }, (_, line) => (
                <span key={line} className={cn("flex h-5 items-center", column.align === "right" && "justify-end", line > 0 && "mt-1")}>
                  <PlaceholderLine width={line > 0 ? "date" : column.width ?? "text"} />
                </span>
              ))}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
