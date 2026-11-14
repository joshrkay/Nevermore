import type { ReactNode } from "react";
import { LoadingStatus } from "./LoadingStatus";

/**
 * The loading state of a page that shows one record (the submission): the page arranges `PlaceholderLine`, `PlaceholderBlock`,
 * `PlaceholderLines` and `PlaceholderPanel` to match its real layout (so nothing jumps when the record arrives), and this holds them
 * with one status for a screen reader (outside any busy element), "Loading <the page's name>". `silent` leaves the status out, for a second place on the
 * page that waits on the same read as one that already says so (D-146: one polite status). The frame around it (back link, menu) is drawn by the page itself.
 */
export function RecordLoading({ name, children, silent = false }: { name: string; children: ReactNode; silent?: boolean }) {
  return (
    <div>
      {!silent && <LoadingStatus name={name} />}
      {children}
    </div>
  );
}
