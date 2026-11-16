/**
 * Who is signed in at this moment, as the app's identity boundary (UserBoundary) last saw it. Work that waits its turn (a queued note of a record opened,
 * useNoteOpened) reads it when its turn comes, not when it was queued: the person who queued it may have signed out, and another signed in, by then.
 */
let current: string | null = null;

export const signedInUser = (): string | null => current;

/** Only UserBoundary sets it. */
export const setSignedInUser = (id: string | null) => { current = id; };
