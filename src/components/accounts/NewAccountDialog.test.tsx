import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const auth = { user: { id: "u1" } as { id: string } | null };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const listAccountOwners = vi.fn();
vi.mock("@/lib/accountCreateApi", () => ({ createAccount: vi.fn(), listAccountOwners: (...a: unknown[]) => listAccountOwners(...a) }));

const { NewAccountDialog } = await import("./NewAccountDialog");

const show = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <NewAccountDialog firmId="f1" person="Someone" onClose={() => {}} onCreated={() => {}} />
    </QueryClientProvider>,
  );

describe("NewAccountDialog: the owner choices", () => {
  // Catches: the choices of one person (a lead's teams) served from the cache to the next person who signs in on the same page (an agent's own list).
  it("asks again for the next person to sign in, and never serves one person's choices to another", async () => {
    const client = new QueryClient();
    listAccountOwners.mockReset().mockResolvedValueOnce([{ value: "u1", label: "Dana Reyes" }, { value: "u2", label: "Marcus Hale" }]);
    auth.user = { id: "u1" };
    const first = show(client);
    expect(await screen.findByRole("option", { name: "Marcus Hale" })).toBeInTheDocument();
    first.unmount();

    listAccountOwners.mockResolvedValueOnce([{ value: "u3", label: "Ines Park" }]);
    auth.user = { id: "u3" };
    show(client);
    await waitFor(() => expect(listAccountOwners).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("option", { name: "Ines Park" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Marcus Hale" })).not.toBeInTheDocument();
  });

  // Catches: the choices asked for before it is known who is asking.
  it("does not ask before the person is known", async () => {
    listAccountOwners.mockReset();
    auth.user = null;
    show(new QueryClient());
    await new Promise((r) => setTimeout(r, 30));
    expect(listAccountOwners).not.toHaveBeenCalled();
  });
});
