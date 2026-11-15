import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/**
 * Empties the app's cached answers when the signed-in person goes or changes. There is one cache for the whole app and it outlives a sign-out, so without
 * this a second person signing in at the same tab could be shown what the database answered the first (a search result, a list of recent records). A
 * first sign-in, with nobody before it, keeps the cache. It watches the session rather than the sign-out button, so a session that lapses is covered too.
 */
export default function ClearCacheOnUserChange() {
  const queryClient = useQueryClient();
  const userId = useAuth().user?.id ?? null;
  const was = useRef(userId);
  useEffect(() => {
    if (was.current !== null && was.current !== userId) queryClient.clear();
    was.current = userId;
  }, [userId, queryClient]);
  return null;
}
