import { Fragment, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { setSignedInUser } from "@/lib/signedInUser";

/**
 * The app's line between one signed-in person and the next. There is one cache for the whole app and it outlives a sign-out, and pages hold what they
 * loaded in their own state, so without this a second person signing in at the same tab could be shown what the database answered the first (a search
 * result, a table's rows, a record's page) for as long as it took each page to notice.
 *
 * So when the person goes or changes, this empties the cache and remounts everything below it, in the same render: nothing below ever draws with the
 * previous person's answers. It is done while rendering, not in an effect, because an effect runs only after the screen has been drawn. Both steps are
 * safe to repeat. A first sign-in, with nobody before it, keeps the cache and the pages. It watches the session rather than the sign-out button, so a
 * session that lapses is covered too. It also records who is signed in now, for work that waits its turn (signedInUser).
 */
export default function UserBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const userId = useAuth().user?.id ?? null;
  const was = useRef(userId);
  const generation = useRef(0);
  if (was.current !== userId) {
    if (was.current !== null) {
      queryClient.clear();
      generation.current += 1;
    }
    was.current = userId;
  }
  setSignedInUser(userId);
  return <Fragment key={generation.current}>{children}</Fragment>;
}
