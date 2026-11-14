import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  /** The page the rows on screen belong to, from 1: what the range says. */
  page: number;
  /** The page the address asks for, which can be ahead of the rows on screen while the next page loads: what Previous and Next step from. */
  at: number;
  total: number;
  pageSize: number;
  /** The address of another page: a real link, so a new tab and Back work. */
  hrefFor: (page: number) => string;
  /** What a row is, for the range line: "1 to 50 of 375 submissions". */
  noun: { singular: string; plural: string };
  /** The search the rows were found for, which the range line says when there is one. */
  search?: string;
}

/** "1 to 50 of 375" with Previous and Next. The range is a polite live region, so a screen reader hears it once when the page changes. */
const rangeText = (page: number, total: number, pageSize: number): string => {
  if (total === 0) return "0 of 0";
  const first = (page - 1) * pageSize + 1;
  return `${first} to ${Math.min(total, page * pageSize)} of ${total}`;
};

const base = "inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border";

export function Pager({ page, at, total, pageSize, hrefFor, noun, search }: Props) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Pages" className="mt-3 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">{rangeText(page, total, pageSize)} {total === 1 ? noun.singular : noun.plural}{search ? ` matching “${search}”` : ""}</p>
      <div className="flex items-center gap-2">
        {at > 1 ? (
          <Link to={hrefFor(at - 1)} rel="prev" className={`${base} hover:bg-muted`}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={`${base} opacity-50`}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
          </span>
        )}
        {at < last ? (
          <Link to={hrefFor(at + 1)} rel="next" className={`${base} hover:bg-muted`}>
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span aria-disabled="true" className={`${base} opacity-50`}>
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
