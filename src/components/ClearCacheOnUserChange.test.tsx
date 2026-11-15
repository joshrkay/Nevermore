import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.userId ? { id: auth.userId } : null }) }));

const { default: ClearCacheOnUserChange } = await import("./ClearCacheOnUserChange");

const draw = (queries: QueryClient) => (
  <QueryClientProvider client={queries}><ClearCacheOnUserChange /></QueryClientProvider>
);
afterEach(() => { cleanup(); auth.userId = null; });

describe("ClearCacheOnUserChange", () => {
  it("empties the cache when the person signs out, so the next person starts with nothing of theirs", () => {
    const queries = new QueryClient();
    auth.userId = "u1";
    const view = render(draw(queries));
    queries.setQueryData(["recent-records", "f1", "u1"], [1]);
    auth.userId = null;
    act(() => { view.rerender(draw(queries)); });
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
  });

  it("empties it when another person takes over without a sign-out between", () => {
    const queries = new QueryClient();
    auth.userId = "u1";
    const view = render(draw(queries));
    queries.setQueryData(["x"], 1);
    auth.userId = "u2";
    act(() => { view.rerender(draw(queries)); });
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
  });

  it("keeps the cache when the same person stays, and when nobody was signed in before (a first sign-in)", () => {
    const queries = new QueryClient();
    const view = render(draw(queries));
    queries.setQueryData(["x"], 1);
    auth.userId = "u1";
    act(() => { view.rerender(draw(queries)); });
    act(() => { view.rerender(draw(queries)); });
    expect(queries.getQueryData(["x"])).toBe(1);
  });
});
