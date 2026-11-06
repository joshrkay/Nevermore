import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const auth = {
  user: null as { id: string; email?: string } | null,
  isAnonymous: false,
  signOut: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));

const { default: SignOutButton } = await import("./SignOutButton");

let pathWhenSignedOut: string | null = null;
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const renderAt = (path: string, saveFirst?: () => Promise<boolean>) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Where />} />
        <Route path="/start" element={<SignOutButton saveFirst={saveFirst} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("SignOutButton (prospects)", () => {
  beforeEach(() => {
    auth.user = null;
    auth.isAnonymous = false;
    pathWhenSignedOut = null;
    auth.signOut.mockReset().mockImplementation(async () => {
      // What was on screen when the session ended: the landing route renders `where`, the Chamber doesn't.
      pathWhenSignedOut = document.querySelector("[data-testid=where]")?.textContent ?? "still on /start";
    });
    toast.success.mockReset();
  });

  it("isn't offered to a guest, whose intake only this browser can reopen", () => {
    auth.user = { id: "guest" };
    auth.isAnonymous = true;
    renderAt("/start");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("signs a verified prospect out after leaving the Chamber, so no guest session starts in its place", async () => {
    auth.user = { id: "u1", email: "pat@example.com" };
    renderAt("/start");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
    // The Chamber (under RequireAuth) was already gone when the session ended.
    expect(pathWhenSignedOut).toBe("/");
    expect(screen.getByTestId("where")).toHaveTextContent("/");
    expect(toast.success).toHaveBeenCalledWith("You've signed out. Your answers stay with your account.");
  });

  it("saves the Chamber's pending answers before signing out", async () => {
    auth.user = { id: "u1", email: "pat@example.com" };
    const saveFirst = vi.fn().mockResolvedValue(true);
    renderAt("/start", saveFirst);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
    expect(saveFirst).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("You've signed out. Your answers stay with your account.");
  });

  it("asks before discarding answers that couldn't be saved, since signing out also clears this browser's copy", async () => {
    auth.user = { id: "u1", email: "pat@example.com" };
    const saveFirst = vi.fn().mockResolvedValue(false);
    renderAt("/start", saveFirst);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("couldn't be saved");
    expect(auth.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sign out anyway" }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
    expect(pathWhenSignedOut).toBe("/");
    // Not "your answers stay with your account": the latest ones didn't.
    expect(toast.success).toHaveBeenCalledWith("You've signed out.");
  });
});
