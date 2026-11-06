import { cn } from "@/lib/utils";

/**
 * Nevermore's mark: a speech bubble with a check in it (answer once, and it's done). It takes its colour from the
 * text colour, so give it a text class (`text-primary`). It is decoration beside the name, so screen readers skip it.
 */
export const BrandMark = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 34 34" className={cn("shrink-0", className)} aria-hidden="true" focusable="false">
    <path d="M6 4h22a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H14l-7 6v-6H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="currentColor" />
    <path d="M11 15l4 4 8-8" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The name as it is set in the logo: lowercase and extra bold. */
export const Wordmark = ({ className }: { className?: string }) => (
  <span className={cn("font-display font-extrabold tracking-tight text-foreground", className)}>nevermore</span>
);
