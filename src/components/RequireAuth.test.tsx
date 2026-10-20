import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = {
  user: null as { id: string } | null,
  loading: false,
  signInAnonymously: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const { default: RequireAuth } = await import("./RequireAuth");

const renderGuarded = () =>
  render(
    <MemoryRouter initialEntries={["/start"]}>
      <Routes>
        <Route path="/start" element={<RequireAuth><p>The Chamber</p></RequireAuth>} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("RequireAuth", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.signInAnonymously = vi.fn().mockResolvedValue({ error: null });
  });

  it("gives a signed-out visitor a guest session instead of sending them to log in", async () => {
    renderGuarded();
    await waitFor(() => expect(auth.signInAnonymously).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
  });

  it("shows the Chamber once the guest session exists, without starting another", () => {
    auth.user = { id: "guest-1" };
    renderGuarded();
    expect(screen.getByText("The Chamber")).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("falls back to the login page when guest sessions aren't available", async () => {
    auth.signInAnonymously = vi.fn().mockResolvedValue({ error: new Error("Anonymous sign-ins are disabled") });
    renderGuarded();
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("asks for a guest session only once while it is being created", async () => {
    const { rerender } = renderGuarded();
    rerender(
      <MemoryRouter initialEntries={["/start"]}>
        <Routes>
          <Route path="/start" element={<RequireAuth><p>The Chamber</p></RequireAuth>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(auth.signInAnonymously).toHaveBeenCalledTimes(1));
  });
});

describe("RequireAuth with CAPTCHA protection", () => {
  type TurnstileOptions = { sitekey: string; callback: (token: string) => void; "error-callback": () => void };
  let widgetOptions: TurnstileOptions | null = null;
  const turnstile = {
    render: vi.fn((_el: HTMLElement, options: TurnstileOptions) => { widgetOptions = options; return "widget-1"; }),
    remove: vi.fn(),
  };

  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.signInAnonymously = vi.fn().mockResolvedValue({ error: null });
    widgetOptions = null;
    turnstile.render.mockClear();
    turnstile.remove.mockClear();
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key-123");
    (window as unknown as { turnstile?: unknown }).turnstile = turnstile;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((s) => s.remove());
  });

  it("shows the challenge and holds back the guest session until it is solved", async () => {
    renderGuarded();
    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    expect(widgetOptions?.sitekey).toBe("site-key-123");
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("requests the guest session with the CAPTCHA token once the challenge is solved", async () => {
    renderGuarded();
    await waitFor(() => expect(widgetOptions).not.toBeNull());
    widgetOptions!.callback("solved-token");
    await waitFor(() => expect(auth.signInAnonymously).toHaveBeenCalledWith("solved-token"));
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("falls back to the login page if the challenge can't run", async () => {
    renderGuarded();
    await waitFor(() => expect(widgetOptions).not.toBeNull());
    widgetOptions!["error-callback"]();
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("loads Cloudflare's script when it isn't already on the page", async () => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    renderGuarded();
    await waitFor(() => expect(document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')).not.toBeNull());
  });

  it("shows no challenge when CAPTCHA isn't configured", async () => {
    vi.unstubAllEnvs();
    renderGuarded();
    await waitFor(() => expect(auth.signInAnonymously).toHaveBeenCalledTimes(1));
    expect(turnstile.render).not.toHaveBeenCalled();
  });
});
