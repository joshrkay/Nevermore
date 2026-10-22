import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const signOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signOut }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { default: AdvisorLoadError } = await import("./AdvisorLoadError");
const { AdvisorApiError } = await import("@/lib/advisorApi");

const renderError = (error: Error, onRetry = vi.fn()) => {
  render(
    <MemoryRouter>
      <AdvisorLoadError error={error} what="submissions" onRetry={onRetry} />
    </MemoryRouter>,
  );
  return onRetry;
};

describe("AdvisorLoadError", () => {
  beforeEach(() => signOut.mockReset().mockResolvedValue(undefined));

  it("explains an ordinary failure and offers to retry", () => {
    const onRetry = renderError(new Error("Network request failed"));
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load submissions.");
    expect(screen.getByRole("alert")).toHaveTextContent("Network request failed");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("ends an expired session and sends the advisor to sign in again", () => {
    renderError(new AdvisorApiError("Your session has expired. Sign in again to continue.", "PGRST301", true));
    expect(screen.getByRole("alert")).toHaveTextContent("Your session has expired");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith("expired");
  });

  it("tells someone whose advisor access has gone, without offering a pointless retry", () => {
    renderError(new AdvisorApiError("You don't have advisor access.", "42501"));
    expect(screen.getByRole("alert")).toHaveTextContent("You no longer have advisor access");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign in with another account" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });
});
