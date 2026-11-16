import { useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

// The line between one signed-in person and the next (UserBoundary): what is below it never draws with the previous person's answers.

const auth = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.userId ? { id: auth.userId } : null }) }));

const { default: UserBoundary } = await import("./UserBoundary");
const { signedInUser } = await import("@/lib/signedInUser");

// A page that reads a cached answer whose key names no person (as a table's rows do) and keeps some state of its own; it notes every value it drew.
let drawn: unknown[] = [];
let mounts = 0;
function Page() {
  const [mountedAs] = useState(() => { mounts += 1; return mounts; });
  const rows = useQuery({ queryKey: ["rows"], queryFn: () => new Promise<string>(() => {}), staleTime: Infinity });
  drawn.push(rows.data);
  return <span>{mountedAs}</span>;
}
const draw = (queries: QueryClient) => (
  <QueryClientProvider client={queries}><UserBoundary><Page /></UserBoundary></QueryClientProvider>
);
afterEach(() => { cleanup(); auth.userId = null; drawn = []; mounts = 0; });

describe("UserBoundary", () => {
  it("never draws the page with the previous person's answer when another person takes over, and starts the page afresh", () => {
    const queries = new QueryClient();
    queries.setQueryData(["rows"], "u1's rows");
    auth.userId = "u1";
    const view = render(draw(queries));
    expect(drawn.at(-1)).toBe("u1's rows");
    drawn = [];

    auth.userId = "u2";
    act(() => { view.rerender(draw(queries)); });
    expect(drawn).not.toContain("u1's rows");
    expect(queries.getQueryData(["rows"])).toBeUndefined();
    expect(mounts).toBe(2);
    expect(signedInUser()).toBe("u2");
  });

  it("empties the cache when the person signs out", () => {
    const queries = new QueryClient();
    auth.userId = "u1";
    const view = render(draw(queries));
    queries.setQueryData(["recent-records", "f1", "u1"], [1]);
    auth.userId = null;
    act(() => { view.rerender(draw(queries)); });
    expect(queries.getQueryData(["recent-records", "f1", "u1"])).toBeUndefined();
    expect(signedInUser()).toBeNull();
  });

  it("keeps the cache and the page when the same person stays, and when nobody was signed in before (a first sign-in)", () => {
    const queries = new QueryClient();
    const view = render(draw(queries));
    queries.setQueryData(["x"], 1);
    auth.userId = "u1";
    act(() => { view.rerender(draw(queries)); });
    act(() => { view.rerender(draw(queries)); });
    expect(queries.getQueryData(["x"])).toBe(1);
    expect(mounts).toBe(1);
    expect(signedInUser()).toBe("u1");
  });
});
