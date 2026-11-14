import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

/**
 * A record that no longer exists, or that the person may not see (CRM-S2.3, D-176): "This submission isn't available." with a link back to the
 * list. ONE state for both, in the same words, so a person can't learn from it whether a record exists that they may not open: the database
 * returns the same nothing for a record that is gone, one in another firm and one whose id is no id. It is not an error (no alert, no "Try
 * again": asking again can't change it) and not a wait (no status). When it appears it takes focus on its heading, which is what a screen
 * reader needs to hear that the page they opened has nothing on it.
 */
export function NotAvailable({ noun, backTo, backLabel }: { noun: string; backTo: string; backLabel: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="border border-dashed border-border rounded-xl p-12 text-center">
      <h1 ref={heading} tabIndex={-1} className="font-display text-xl font-bold focus:outline-none">This {noun} isn't available.</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">It may have been removed, or you may not be able to open it.</p>
      <Link to={backTo} className="text-primary underline hover:text-primary/90">{backLabel}</Link>
    </section>
  );
}
