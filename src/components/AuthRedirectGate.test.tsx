import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const auth = { loading: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const Where = () => {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
};

/**
 * Loads the app as if the browser had opened `address`. The gate reads the address the page opened
 * with when its module loads, so each case imports it afresh.
 */
async function openApp(address: string) {
  window.history.replaceState(null, "", address);
  vi.resetModules();
  const { default: AuthRedirectGate } = await import("./AuthRedirectGate");
  const url = new URL(address, window.location.origin);
  return render(
    <MemoryRouter initialEntries={[url.pathname + url.search]}>
      <AuthRedirectGate>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthRedirectGate>
    </MemoryRouter>,
  );
}

describe("AuthRedirectGate", () => {
  beforeEach(() => {
    auth.loading = false;
  });
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("sends a refused link that landed on the site root to the callback page", async () => {
    await openApp("/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/auth\/callback$/);
  });

  it("sends an older email's link to /start through the callback page, then back to /start", async () => {
    await openApp("/start#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=signup");
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/auth\/callback$/);
  });

  it("keeps where the person was headed", async () => {
    await openApp("/advisor#error=access_denied&error_code=otp_expired");
    expect(screen.getByTestId("where")).toHaveTextContent("/auth/callback?next=%2Fadvisor");
  });

  it("holds the page until supabase-js has read the session, so moving on can't lose it", async () => {
    auth.loading = true;
    const view = await openApp("/start#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=signup");
    // Nothing under the gate renders yet: /start would otherwise start a guest session.
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
    auth.loading = false;
    const { default: AuthRedirectGate } = await import("./AuthRedirectGate");
    view.rerender(
      <MemoryRouter initialEntries={["/start"]}>
        <AuthRedirectGate>
          <Routes>
            <Route path="*" element={<Where />} />
          </Routes>
        </AuthRedirectGate>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/auth\/callback$/);
  });

  it("sends a sign-up email's token that landed on the bare Site URL to the callback page", async () => {
    await openApp("/#token_hash=abc&type=email");
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/auth\/callback$/);
  });

  it("leaves a link that already landed on the callback page alone", async () => {
    await openApp("/auth/callback?token_hash=abc&type=email");
    expect(screen.getByTestId("where")).toHaveTextContent("/auth/callback?token_hash=abc&type=email");
  });

  it("does nothing for an ordinary visit or a section link", async () => {
    await openApp("/#peo-partners");
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
    await openApp("/start?session=abc");
    expect(screen.getAllByTestId("where").at(-1)).toHaveTextContent("/start?session=abc");
  });
});
