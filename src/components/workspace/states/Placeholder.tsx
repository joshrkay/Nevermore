import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The grey shapes the loading states are drawn with (story CRM-S2.1). Each is plain and hidden from a screen reader by whoever
// holds it: a loading state says what is loading once, in `LoadingStatus`, and never row by row. The shimmer is Tailwind's `pulse`, and
// only for people who haven't asked for less motion (`motion-safe`).

// A little stronger than the page's own muted tone, which is about 1.08:1 on a white card and half that again at the pulse's low point.
const BAR = "block rounded bg-muted-foreground/30 motion-safe:animate-pulse";

/** How wide a grey bar is, by what the cell will hold. */
export type PlaceholderWidth = "name" | "text" | "person" | "date" | "number" | "badge";

const WIDTHS: Record<PlaceholderWidth, string> = {
  name: "w-48",
  text: "w-36",
  person: "w-32",
  date: "w-24",
  number: "w-10",
  badge: "w-20",
};

/** One grey line of text, as tall as a line of the table's text. */
export function PlaceholderLine({ width = "text", className }: { width?: PlaceholderWidth | "full"; className?: string }) {
  return <span className={cn(BAR, "h-3.5 max-w-full", width === "full" ? "w-full" : WIDTHS[width], width === "badge" && "rounded-full", className)} />;
}

/** A grey block: a picture, a box of text, a form's field. Give it a height with `className` (`h-24`). */
export function PlaceholderBlock({ className }: { className?: string }) {
  return <span className={cn(BAR, "h-16 w-full", className)} />;
}

/** A list of grey lines, one under the other, the last a little shorter as a paragraph's is. */
export function PlaceholderLines({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <span className={cn("block space-y-2", className)}>
      {Array.from({ length: count }, (_, i) => (
        <PlaceholderLine key={i} width={i === count - 1 && count > 1 ? "text" : "full"} className="block" />
      ))}
    </span>
  );
}

/**
 * A panel the way the real ones are drawn, with its real heading and grey lines where its content will be. The heading is not
 * a placeholder: the page's frame shows at once.
 */
export function PlaceholderPanel({ heading, children, className }: { heading: string; children?: ReactNode; className?: string }) {
  return (
    <section className={cn("border border-border rounded-xl p-5", className)}>
      <h2 className="font-display text-lg font-bold mb-3">{heading}</h2>
      <div aria-hidden="true" aria-busy="true">{children ?? <PlaceholderLines />}</div>
    </section>
  );
}
