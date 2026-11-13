import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const auth = { user: null as { id: string; email: string } | null, loading: false, isAnonymous: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const signUpFirm = vi.fn();
vi.mock("@/lib/firmApi", () => ({ signUpFirm: (...a: unknown[]) => signUpFirm(...a) }));

const { default: SignUpFirmPage } = await import("./SignUpFirmPage");

// Stands in for the sign-in page: shows where it was sent from and why.
const SignIn = () => {
  const state = useLocation().state as { from?: { pathname: string }; reason?: string } | null;
  return <p>Sign in page, back to {state?.from?.pathname}, {state?.reason}</p>;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/firms/new"]}>
      <Routes>
        <Route path="/firms/new" element={<SignUpFirmPage />} />
        <Route path="/login" element={<SignIn />} />
      </Routes>
    </MemoryRouter>,
  );

const fill = (name: string, address: string) => {
  fireEvent.change(screen.getByLabelText("Firm name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Firm address"), { target: { value: address } });
};

// A person signs their firm up here (story CRM-P1.1). The database applies every rule; the page shows what it said.
describe("SignUpFirmPage", () => {
  beforeEach(() => {
    cleanup();
    auth.user = { id: "u1", email: "founder@example.test" };
    auth.loading = false;
    auth.isAnonymous = false;
    signUpFirm.mockReset().mockResolvedValue("firm-1");
  });

  it("sends a signed-out visitor to create an account first, and brings them back", () => {
    auth.user = null;
    renderPage();
    expect(screen.getByText("Sign in page, back to /firms/new, account_needed")).toBeInTheDocument();
  });

  it("does not take a guest session for an account", () => {
    auth.isAnonymous = true;
    renderPage();
    expect(screen.getByText(/^Sign in page/)).toBeInTheDocument();
  });

  it("shows nothing while it is not yet known who is signed in", () => {
    auth.user = null;
    auth.loading = true;
    renderPage();
    expect(screen.queryByText(/^Sign in page/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Firm name")).not.toBeInTheDocument();
  });

  it("asks for the firm's name and its address, and shows where the address will be", () => {
    renderPage();
    expect(screen.getByLabelText("Firm name")).toBeInTheDocument();
    expect(screen.getByLabelText("Firm address")).toBeInTheDocument();
    expect(screen.getByText(".nevermorepeo.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up your firm" })).toBeDisabled();
  });

  it("says who the owner will be, and that approval is needed before anything is sent to a PEO", () => {
    renderPage();
    expect(screen.getByText(/You'll be the firm's owner, signed in as founder@example\.test/)).toBeInTheDocument();
    expect(screen.getByText(/can't send to a PEO until a Nevermore admin approves it/)).toBeInTheDocument();
  });

  it("signs the firm up with what was typed, and then says it is waiting for approval and where it is", async () => {
    renderPage();
    fill("Fresh Benefits", "Fresh-Benefits");
    fireEvent.click(screen.getByRole("button", { name: "Sign up your firm" }));
    await waitFor(() => expect(signUpFirm).toHaveBeenCalledWith("Fresh Benefits", "Fresh-Benefits"));
    expect(await screen.findByRole("heading", { name: "Fresh Benefits is set up" })).toBeInTheDocument();
    expect(screen.getByText(/waiting for approval/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "https://fresh-benefits.nevermorepeo.com" });
    expect(link).toHaveAttribute("href", "https://fresh-benefits.nevermorepeo.com");
    expect(screen.getByText(/Sign in there/)).toBeInTheDocument();
  });

  it("shows the reason when the database refuses, and keeps what was typed", async () => {
    signUpFirm.mockRejectedValue(new Error("That address is taken. Choose another."));
    renderPage();
    fill("Fresh Benefits", "taken");
    fireEvent.click(screen.getByRole("button", { name: "Sign up your firm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That address is taken. Choose another.");
    expect(screen.getByLabelText("Firm name")).toHaveValue("Fresh Benefits");
    expect(screen.getByLabelText("Firm address")).toHaveValue("taken");
    expect(screen.getByRole("button", { name: "Sign up your firm" })).toBeEnabled();
  });

  it("does not send twice while the first is on its way", async () => {
    let finish: (id: string) => void = () => {};
    signUpFirm.mockReturnValue(new Promise<string>((resolve) => { finish = resolve; }));
    renderPage();
    fill("Fresh Benefits", "fresh-benefits");
    const button = screen.getByRole("button", { name: "Sign up your firm" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    finish("firm-1");
    await screen.findByRole("heading", { name: "Fresh Benefits is set up" });
    expect(signUpFirm).toHaveBeenCalledTimes(1);
  });

  it("does not send twice when the form is submitted again by the keyboard while the first is on its way", async () => {
    let finish: (id: string) => void = () => {};
    signUpFirm.mockReturnValue(new Promise<string>((resolve) => { finish = resolve; }));
    renderPage();
    fill("Fresh Benefits", "fresh-benefits");
    const form = screen.getByRole("form", { name: "Sign up your firm" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    finish("firm-1");
    await screen.findByRole("heading", { name: "Fresh Benefits is set up" });
    expect(signUpFirm).toHaveBeenCalledTimes(1);
  });

  it("names the firm without the spaces around what was typed", async () => {
    renderPage();
    fill("  Fresh Benefits  ", "fresh-benefits");
    fireEvent.click(screen.getByRole("button", { name: "Sign up your firm" }));
    await screen.findByText(/waiting for approval/);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Fresh Benefits is set up");
  });
});
