// The first column is pinned to the left of the table's scroll box (story CRM-S3.1a), so a person reading the far columns still sees whose row it is.
// A pinned cell must be opaque or the columns scrolling under it show through: the card's own colour with the header's or the row hover's tint laid
// over it as an image, which is what the translucent tint looks like on the card. The line on its right is an inset shadow, because a border does not
// travel with a pinned cell.
const PINNED = "sticky left-0 z-10 bg-card shadow-[inset_-1px_0_0_hsl(var(--border))]";

/** The classes of the first header cell. */
export const PINNED_HEADER = `${PINNED} bg-[linear-gradient(hsl(var(--muted)/0.6),hsl(var(--muted)/0.6))]`;

/** The classes of the first cell of a row; the row is a `group`, so its hover tints the cell as it tints the rest. */
export const PINNED_CELL = `${PINNED} group-hover:bg-[linear-gradient(hsl(var(--muted)/0.5),hsl(var(--muted)/0.5))]`;
