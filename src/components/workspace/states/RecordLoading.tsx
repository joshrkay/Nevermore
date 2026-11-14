import type { ReactNode } from "react";
import { LoadingStatus } from "./LoadingStatus";

/**
 * The loading state of a page that shows one record (the submission): the page arranges `PlaceholderLine`, `PlaceholderBlock`,
 * `PlaceholderLines` and `PlaceholderPanel` to match its real layout (so nothing jumps when the record arrives), and this holds them
 * with one status for a screen reader, "Loading <the page's name>". The frame around it (back link, menu) is drawn by the page itself.
 */
export function RecordLoading({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div aria-busy="true">
      <LoadingStatus name={name} />
      {children}
    </div>
  );
}
