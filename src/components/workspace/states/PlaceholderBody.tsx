import { cn } from "@/lib/utils";
import { PlaceholderLine } from "./Placeholder";
import { PLACEHOLDER_ROWS, type PlaceholderColumn } from "./placeholderShapes";

/**
 * The grey rows themselves: a `tbody` hidden from assistive technology, each row as tall as a real row (the same cell padding and text
 * height). `cellClassName` is the real table's own cell padding where a page's table differs from the table frame's. `pinFirst` pins the first
 * cell to the left edge as the real table's first column is (CRM-S3.1a), so the grey rows and the real ones scroll alike.
 */
export function PlaceholderBody({ columns, rows = PLACEHOLDER_ROWS, cellClassName = "px-4 py-3 align-top", pinFirst }: { columns: PlaceholderColumn[]; rows?: number; cellClassName?: string; pinFirst?: boolean }) {
  return (
    <tbody aria-hidden="true" aria-busy="true">
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-border last:border-0">
          {columns.map((column, i) => (
            <td key={column.id} className={cn(cellClassName, pinFirst && i === 0 && "sticky left-0 z-10 bg-card")}>
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
